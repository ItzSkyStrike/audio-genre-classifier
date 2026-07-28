# Use Python 3.14 to match the environment where the model was trained
FROM python:3.14-slim

WORKDIR /code

# Force Python to print logs immediately (bypasses the silent crash trap)
ENV PYTHONUNBUFFERED=1

# Install system dependencies required by librosa, torchaudio, and scikit-learn
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code and the model file
COPY . .

# Expose the port FastAPI runs on
EXPOSE 80

# Start the application using the bulletproof python module method
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
