from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import torch
import torchaudio
import torchaudio.transforms as T
from torchvision import models, transforms
import torch.nn as nn
from PIL import Image
import os
import joblib
import pandas as pd
import numpy as np
import librosa

app = FastAPI(title="Spotify Hit & Genre Predictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # This tells the backend to accept requests from anywhere
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print("Loading local models...")
# 1. Load the Tabular Hit Predictor
hit_model = joblib.load('spotify_hit_predictor_model.joblib')

# 2. Load the Deep Learning Vision Model (Forced to CPU)
device = torch.device("cpu")
vision_checkpoint = torch.load('music_vision_model.pth', map_location=device)
classes = vision_checkpoint['classes']

cnn_model = models.resnet18(weights=None)
num_features = cnn_model.fc.in_features
cnn_model.fc = nn.Linear(num_features, len(classes))
cnn_model.load_state_dict(vision_checkpoint['model_state_dict'])
cnn_model.eval()

# Image formatting for the CNN
img_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])


@app.post("/predict")
async def predict_audio(file: UploadFile = File(...)):
    temp_file_path = f"temp_{file.filename}"

    with open(temp_file_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        # --- 1. DEEP LEARNING GENRE PREDICTION WITH SOFTMAX ---
        waveform, sr = torchaudio.load(temp_file_path)

        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)

        mel_transform = T.MelSpectrogram(sample_rate=sr, n_mels=128)
        mel_spec = mel_transform(waveform)
        mel_spec_db = T.AmplitudeToDB()(mel_spec)

        spec_np = mel_spec_db[0].numpy()
        spec_normalized = (spec_np - spec_np.min()) / (spec_np.max() - spec_np.min()) * 255
        img = Image.fromarray(spec_normalized.astype('uint8')).convert("RGB")

        img_tensor = img_transform(img).unsqueeze(0)

        with torch.no_grad():
            outputs = cnn_model(img_tensor)
            # Convert raw logits to true 0-100% probabilities
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence_tensor, predicted = torch.max(probabilities, 1)

            predicted_genre = classes[predicted.item()].capitalize()
            genre_confidence = round(confidence_tensor.item() * 100, 2)

        # --- 2. REAL AUDIO FEATURE EXTRACTION ---
        y, audio_sr = librosa.load(temp_file_path, sr=22050, duration=30)

        # Tempo
        tempo_val, _ = librosa.beat.beat_track(y=y, sr=audio_sr)
        tempo = float(tempo_val[0]) if isinstance(tempo_val, np.ndarray) else float(tempo_val)

        # Real Loudness (dB)
        rms = librosa.feature.rms(y=y)
        loudness = float(np.mean(librosa.amplitude_to_db(rms)))

        # Dynamic Energy
        energy = min(0.99, max(0.1, float(np.mean(rms)) * 4.0))

        # Acousticness & Brightness (Spectral Centroid)
        spec_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=audio_sr)))
        acousticness = min(0.95, max(0.01, 1.0 - (spec_centroid / 5000.0)))

        # Speechiness (Zero Crossing Rate)
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y)))
        speechiness = min(0.5, max(0.02, zcr * 3.0))

        # Danceability heuristic based on tempo and energy balance
        danceability = min(0.95, max(0.2, energy * 0.7 + (0.25 if 105 <= tempo <= 130 else 0.0)))

        # Dynamic Valence Calculation (6th Feature)
        valence = min(0.98, max(0.1, (energy * 0.5) + (danceability * 0.4)))

        input_data = {
            'danceability': danceability,
            'energy': energy,
            'valence': valence,
            'tempo': tempo,
            'loudness': loudness,
            'acousticness': acousticness,
            'instrumentalness': 0.0,
            'liveness': 0.12,
            'speechiness': speechiness,
            'duration_ms': 210000,
            'explicit': 0,
            'key': 5,
            'mode': 1,
            'time_signature': 4,
            'hype_index': (energy * tempo) / 100
        }

        # --- 3. HIT PREDICTION ---
        hit_df = pd.DataFrame([input_data])[hit_model.feature_names_in_]
        
        # Get the raw probability of the song being a hit (Class 1)
        raw_prob = hit_model.predict_proba(hit_df)[0][1]

        # Convert to a standard 0-100 percentage
        final_confidence = round(float(raw_prob) * 100, 2)
        
        # Standard ML threshold: If it's 50% or higher, it's a Hit. Otherwise, Pass.
        is_hit = int(final_confidence >= 50.0)

        # Cleanup
        os.remove(temp_file_path)

        return {
            "genre": predicted_genre,
            "genre_confidence": genre_confidence,
            "is_hit": is_hit,
            "confidence": final_confidence,
            "extracted_features": {
                "tempo": round(tempo, 1),
                "energy": round(energy, 2),
                "danceability": round(danceability, 2),
                "loudness": round(loudness, 1),
                "acousticness": round(acousticness, 2),
                "valence": round(valence, 2)
            }
        }

    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        return {"error": str(e)}
