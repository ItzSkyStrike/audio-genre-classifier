# 🎵 AI Hit Predictor — Full-Stack Audio Intelligence Platform

An enterprise-grade, end-to-end Machine Learning web application that analyzes raw audio telemetry to predict commercial hit potential, detect music genres, and extract core acoustic features in real time.

Built with a high-performance **FastAPI** backend containerized on **Azure Container Apps** and paired with a sleek, dark-mode **Next.js** frontend featuring Web Audio API waveform decoding.

---

## 🌟 Key Features

### 🖥️ Next.js Web Audio Frontend (`HitPredictorConsole`)
* **Real-Time Client-Side Waveform Decoding:** Utilizes the browser's native `AudioContext` and `decodeAudioData` to calculate normalized amplitude peaks and render seekable audio waveforms on the fly.
* **Animated Confidence Ring:** Visualizes the model's prediction score using dynamic conic gradients and custom easing animations.
* **Acoustic Breakdown Display:** Displays key acoustic metrics with animated progress meters:
  * **Tempo (BPM)**
  * **Energy & Danceability (%)**
  * **Loudness (dB)**
  * **Acousticness & Mood/Valence (%)**
* **Interactive Player:** Play/pause audio previews, scrub through tracks, and maintain a local session history of recent predictions.

### 🧠 Machine Learning & Backend API
* **Acoustic Feature Extraction:** Leverages `Librosa` to process raw `.mp3` and `.wav` audio files into Mel-spectrograms on the fly.
* **Deep Learning Engine:** Powered by a **PyTorch (ResNet18)** model fine-tuned for audio pattern recognition alongside `Scikit-Learn` classifiers.
* **FastAPI Server:** Exposes lightweight RESTful endpoints (`/predict`) designed for file streaming and JSON response delivery.

---

## 🛠️ Tech Stack

| Domain | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React / Next.js, Tailwind CSS, TypeScript | Client interface, Web Audio API waveform processing, interactive player |
| **Backend** | FastAPI, Uvicorn, Python 3.10+ | REST API, async request handling, model serving |
| **Machine Learning** | PyTorch, Librosa, Scikit-Learn | Audio processing, Mel-spectrogram extraction, prediction modeling |
| **Cloud & DevOps** | Azure Container Apps, Docker, GitHub Actions | Serverless container deployment, custom TCP health probes |

---

## 💡 Cloud Engineering & DevOps Highlights

Deploying heavy Machine Learning libraries (`PyTorch`, `Librosa`) on resource-constrained cloud infrastructure introduces significant memory and cold-start challenges.

### 🎯 Right-Sizing Hardware Constraints
* **Allocation:** Configured to run on **1.0 vCPU and 2.0 GB RAM** to maximize cost efficiency on Azure.
* **Resource Optimization:** Holds heavy model weights in memory while consuming **< 0.08 vCPU cores** during idle states, keeping operational costs minimal without compromising response latency.

### ⚙️ Custom Kubernetes Probes (Solving Cold Starts)
To prevent Azure from timing out or prematurely terminating containers during boot due to heavy library imports:
* Custom **Startup, Liveness, and Readiness TCP Probes** were engineered.
* Configured initial startup delays and failure thresholds to allow a **5-minute boot buffer**, guaranteeing container stability on single vCPU setups.

---

## 🔌 API Documentation

### `POST /predict`
Accepts a raw audio file upload and returns prediction scores alongside extracted acoustic telemetry.

**Request Header:**
`Content-Type: multipart/form-data`

**Request Body:**
* `file`: Audio file (`.mp3` or `.wav`)

**Sample JSON Response:**
```json
{
  "is_hit": 1,
  "confidence": 88.5,
  "genre": "Pop / Dance",
  "extracted_features": {
    "tempo": 124.0,
    "energy": 0.82,
    "danceability": 0.76,
    "loudness": -5.4,
    "acousticness": 0.12,
    "valence": 0.68
  }
}
