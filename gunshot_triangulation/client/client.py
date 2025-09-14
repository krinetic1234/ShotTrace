import argparse
import os
import requests

url = "http://localhost:5001/api/gunshot-location"


def send_gunshot_location(mic_1, mic_2, mic_3):
    # Send gunshot location to API server
    response = requests.post(url, json={
        "mic1": mic_1,
        "mic2": mic_2,
        "mic3": mic_3
    })

    print(response.json())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio_dir", type=str, help="Path to audio directory")
    args = parser.parse_args()

    audio_dir = args.audio_dir

    mic_1 = os.path.join(audio_dir, "mic_1.wav")
    mic_2 = os.path.join(audio_dir, "mic_2.wav")
    mic_3 = os.path.join(audio_dir, "mic_3.wav")

    send_gunshot_location(mic_1, mic_2, mic_3)
