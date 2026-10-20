import asyncio
import os
import re
import subprocess
import sys
import time
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

SCENE_METRICS = [
    {"file": "scratch_audio/scene1_intro.mp3", "action": "intro"},
    {"file": "scratch_audio/scene2_scam_hold.mp3", "action": "scam_hold"},
    {"file": "scratch_audio/scene3_family_deny.mp3", "action": "family_deny"},
    {"file": "scratch_audio/scene4_pharmacy.mp3", "action": "pharmacy"},
    {"file": "scratch_audio/scene5_console.mp3", "action": "console"},
    {"file": "scratch_audio/scene6_mcp_bench.mp3", "action": "mcp_bench"},
]

def get_duration(file_path):
    cmd = [FFMPEG, "-i", file_path]
    res = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
    match = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", res.stderr)
    if match:
        h, m, s = match.groups()
        return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0

def build_soundtrack():
    print("Building unified soundtrack with silence gaps...")
    silence_file = "scratch_audio/silence_15.mp3"
    subprocess.run([
        FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "1.5", "-q:a", "9", silence_file
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    concat_list = "scratch_audio/concat.txt"
    with open(concat_list, "w") as f:
        for i, s in enumerate(SCENE_METRICS):
            f.write(f"file '{os.path.abspath(s['file']).replace(chr(92), '/')}'\n")
            if i < len(SCENE_METRICS) - 1:
                f.write(f"file '{os.path.abspath(silence_file).replace(chr(92), '/')}'\n")

    soundtrack_file = "scratch_audio/full_soundtrack.mp3"
    subprocess.run([
        FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list, "-c", "copy", soundtrack_file
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    total_dur = get_duration(soundtrack_file)
    print(f"Soundtrack created: {soundtrack_file} (Duration: {total_dur:.2f}s / {total_dur/60:.2f} min)")
    return soundtrack_file, total_dur

def merge_video_and_audio(raw_video, audio_file, output_mp4):
    print(f"Merging video ({raw_video}) and audio ({audio_file}) into {output_mp4}...")
    os.makedirs(os.path.dirname(output_mp4), exist_ok=True)
    cmd = [
        FFMPEG, "-y",
        "-i", raw_video,
        "-i", audio_file,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_mp4
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")
    if res.returncode != 0:
        print("FFmpeg error:", res.stderr)
        raise RuntimeError(f"FFmpeg failed: {res.returncode}")
    print(f"Merged successfully: {output_mp4} ({get_duration(output_mp4):.2f}s)")

if __name__ == "__main__":
    soundtrack, duration = build_soundtrack()
    raw_video = "scratch_audio/raw_video.webm"
    output_mp4 = "docs/assets/Second_Opinion_Demo_3Min.mp4"
    if os.path.exists(raw_video):
        merge_video_and_audio(raw_video, soundtrack, output_mp4)
    else:
        print(f"Raw video {raw_video} does not exist yet. Run playwright test first.")
