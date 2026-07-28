# Use Python 3.14 to match the environment where the model was trained
FROM python:3.14-slim

WORKDIR /code

# Install system dependencies required by librosa and torchaudio
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code and the model file
COPY . .

# Expose the port FastAPI runs on
EXPOSE 80

# Start the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
