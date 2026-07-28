# 🎵 Hit Predictor API

A machine learning-powered REST API built with **FastAPI** that analyzes 30-second audio clips to predict whether a song has the potential to be a commercial hit. 

This API extracts audio features on the fly and utilizes a dual-model approach, combining a deep learning vision model and a tabular machine learning model to make its predictions.

## 🚀 Tech Stack
*   **Framework:** FastAPI & Uvicorn
*   **Audio Processing:** Librosa & Torchaudio
*   **Machine Learning:** PyTorch (ResNet18) & Scikit-Learn (`joblib`)
*   **Containerization:** Docker (`python:3.14-slim`)
*   **Deployment:** Azure Container Apps

## ✨ Features
*   **Audio Feature Extraction:** Automatically processes raw `.wav` or `.mp3` audio files to extract Mel-spectrograms and other key acoustic features.
*   **Deep Learning Inference:** Passes generated spectrograms through a custom PyTorch `ResNet18` architecture.
*   **Ensemble Prediction:** Combines neural network outputs with a tabular model for highly accurate hit predictions.
*   **Interactive UI:** Fully documented Swagger UI available at the `/docs` endpoint for easy testing.

---

## 🛠️ Local Development Setup

### Prerequisites
*   Python 3.9+ 
*   Docker (Optional, but recommended)

### 1. Run via Standard Python
Clone the repository and install the heavy ML dependencies:

```bash
git clone [https://github.com/yourusername/hit-predictor-api.git](https://github.com/yourusername/hit-predictor-api.git)
cd hit-predictor-api

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

# Install dependencies
pip install -r requirements.txt

# Run the Uvicorn server locally
uvicorn main:app --host 0.0.0.0 --port 80 --reload
