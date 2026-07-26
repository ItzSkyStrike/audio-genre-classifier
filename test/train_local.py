import pandas as pd
import numpy as np
from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from imblearn.over_sampling import SMOTE
from sklearn.metrics import accuracy_score, classification_report
import joblib

print("Loading dataset...")
df = pd.read_csv('dataset.csv')

# 1. The "Big 6" Mega-Genre Mapping
print("Mapping Super Genres...")
genre_mapping = {
    'pop': 'Pop/Electronic', 'dance': 'Pop/Electronic', 'edm': 'Pop/Electronic', 'house': 'Pop/Electronic', 'electro': 'Pop/Electronic', 'techno': 'Pop/Electronic',
    'hip-hop': 'Hip-Hop/R&B', 'r-n-b': 'Hip-Hop/R&B', 'soul': 'Hip-Hop/R&B', 'trip-hop': 'Hip-Hop/R&B',
    'rock': 'Rock/Metal', 'alt-rock': 'Rock/Metal', 'metal': 'Rock/Metal', 'heavy-metal': 'Rock/Metal', 'punk-rock': 'Rock/Metal', 'grunge': 'Rock/Metal',
    'classical': 'Acoustic/Classical', 'piano': 'Acoustic/Classical', 'sleep': 'Acoustic/Classical', 'ambient': 'Acoustic/Classical', 'jazz': 'Acoustic/Classical', 'blues': 'Acoustic/Classical',
    'latin': 'Latin', 'salsa': 'Latin', 'reggaeton': 'Latin',
    'country': 'Country', 'bluegrass': 'Country'
}

df['mega_genre'] = df['track_genre'].map(genre_mapping).fillna('Other')
df = df[df['mega_genre'] != 'Other'].copy()

# 2. Advanced Feature Engineering
print("Engineering features...")
df['hype_index'] = df['energy'] * df['danceability']
df['energy_loudness_ratio'] = df['energy'] / (abs(df['loudness']) + 1e-5)
df['acoustic_valence'] = df['acousticness'] * df['valence']
df['speech_dance_ratio'] = df['speechiness'] / (df['danceability'] + 1e-5)
df['is_dance_tempo'] = ((df['tempo'] >= 110) & (df['tempo'] <= 130)).astype(int)

features = [
    'danceability', 'energy', 'valence', 'tempo', 'loudness',
    'acousticness', 'instrumentalness', 'liveness', 'speechiness', 'hype_index',
    'energy_loudness_ratio', 'acoustic_valence', 'speech_dance_ratio', 'is_dance_tempo',
    'duration_ms', 'explicit', 'key', 'mode', 'time_signature'
]

df = df.dropna(subset=features + ['mega_genre'])
X = df[features]

# Encode target labels
le = LabelEncoder()
y = le.fit_transform(df['mega_genre'])

# NEW: Scale the features for maximum accuracy
print("Scaling features...")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 3. Train/Test Split (Using the Scaled Data)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y)

# 4. SMOTE (Balance the dataset)
print("Applying SMOTE...")
smote = SMOTE(random_state=42)
X_train_sm, y_train_sm = smote.fit_resample(X_train, y_train)

# 5. Initialize the Heavyweight Brains (Aggressive Tuning)
print("Initializing Max-Accuracy Models...")
lgb = LGBMClassifier(n_estimators=1000, learning_rate=0.01, max_depth=12, num_leaves=127, random_state=42, n_jobs=-1, verbose=-1)
xgb = XGBClassifier(n_estimators=1000, learning_rate=0.01, max_depth=10, random_state=42, n_jobs=-1, eval_metric='mlogloss')
rf = RandomForestClassifier(n_estimators=500, max_depth=20, random_state=42, n_jobs=-1)

# 6. The Weighted Voting Ensemble
print("Training the Voting Ensemble... (This will take a few minutes!)")
ensemble_model = VotingClassifier(
    estimators=[('lgb', lgb), ('xgb', xgb), ('rf', rf)],
    voting='soft',
    weights=[2, 2, 1] # Give LightGBM and XGBoost double the voting power of Random Forest
)

ensemble_model.fit(X_train_sm, y_train_sm)

# 7. Evaluate
print("Evaluating model...")
y_pred = ensemble_model.predict(X_test)
print(f"\nMax-Accuracy Ensemble: {accuracy_score(y_test, y_pred) * 100:.2f}%\n")

print("Detailed Classification Report:")
y_test_text = le.inverse_transform(y_test)
y_pred_text = le.inverse_transform(y_pred)
print(classification_report(y_test_text, y_pred_text))

# 8. Export Model, Encoder, AND Scaler
joblib.dump({'model': ensemble_model, 'encoder': le, 'scaler': scaler}, 'genre_predictor_model_v3.joblib')
print("\nSuccess! Saved max-accuracy model bundle as 'genre_predictor_model_v3.joblib'")