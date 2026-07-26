import gradio as gr
from main import app as fastapi_app

demo = gr.Blocks()
with demo:
    gr.Markdown("# 🎵 Spotify API is Live")

app = gr.mount_gradio_app(fastapi_app, demo, path="/")