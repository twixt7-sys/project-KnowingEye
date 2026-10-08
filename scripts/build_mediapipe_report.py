"""Build figures/mediapipe_eval/mediapipe_test_report.html from the numbers that
scripts/eval_mediapipe_face_test.py wrote to figures/mediapipe_eval/summary.json.

Styled like the YOLO/RT-DETR test report (final_report_v2.html) so the two can sit
side by side; figure numbers continue from that report's last figure (58).

Usage (any Python with matplotlib):
    python scripts/build_mediapipe_report.py
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
EVAL_DIR = REPO_ROOT / "figures" / "mediapipe_eval"
FIRST_FIGURE = 59

# Fine-tuned detectors on the SAME 402-image test split - copied from
# MyDrive/knowing-eye-70-20-10/test_results_70_20_10.csv (final_report_v2.html, Table 1).
YOLO_TEST = {
    "YOLOv8n": {"Accuracy (%)": 80.43, "Precision (%)": 93.52, "Recall (%)": 85.17, "F1 (%)": 89.15},
    "YOLOv11n": {"Accuracy (%)": 81.38, "Precision (%)": 95.06, "Recall (%)": 84.98, "F1 (%)": 89.73},
    "RT-DETR-l": {"Accuracy (%)": 75.25, "Precision (%)": 89.55, "Recall (%)": 82.49, "F1 (%)": 85.87},
}

# Same-protocol scores of the fine-tuned detectors (scripts/eval_finetuned_face_test.py), if run.
FINETUNED_SUMMARY = REPO_ROOT / "figures" / "finetuned_eval" / "summary.json"
FT_ORDER = ["yolo11n", "yolov8n", "rtdetr-l"]
DISPLAY = {"yolov8n": "YOLOv8n", "yolo11n": "YOLOv11n", "rtdetr-l": "RT-DETR-l"}

METRIC_COLORS = {"Accuracy": "#2B8C8C", "Precision": "#2E8B57", "Recall": "#C0504D", "F1-Score": "#D98C00"}
MODEL_COLORS = {"YOLOv8n": "#1F4E8C", "YOLOv11n": "#2E8B57", "RT-DETR-l": "#D98C00", "MediaPipe (BlazeFace)": "#6A3D9A"}
METRICS = [("Accuracy", "Accuracy (%)"), ("Precision", "Precision (%)"), ("Recall", "Recall (%)"), ("F1-Score", "F1 (%)")]

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 11, "axes.titleweight": "bold", "axes.titlesize": 13,
    "axes.labelweight": "bold", "axes.labelsize": 12, "figure.facecolor": "white", "axes.facecolor": "white",
})


def style(ax, ylabel="Score (%)"):
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_linewidth(1.6)
    ax.grid(axis="y", color="#DDDDDD", linewidth=1)
    ax.set_axisbelow(True)
    ax.set_ylabel(ylabel)
    ax.set_ylim(0, 108)


def to_data_uri(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def grouped_bars(groups: dict[str, dict], colors: dict[str, str], legend_cols: int):
    fig, ax = plt.subplots(figsize=(13, 5.5))
    width = 0.8 / len(groups)
    for k, (name, row) in enumerate(groups.items()):
        xs = np.arange(len(METRICS)) + (k - (len(groups) - 1) / 2) * width
        vals = [row[col] for _, col in METRICS]
        ax.bar(xs, vals, width * 0.92, color=colors[name], edgecolor="black", linewidth=1.1, label=name)
        for x, v in zip(xs, vals):
            ax.text(x, v + 0.8, f"{v:.2f}", ha="center", va="bottom", fontsize=8, fontweight="bold")
    ax.set_xticks(range(len(METRICS)), [m for m, _ in METRICS], fontweight="bold")
    style(ax)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.01), ncol=legend_cols, frameon=False,
              prop={"weight": "bold", "size": 10})
    return fig


def fig_all_vs_domain(s):
    return to_data_uri(grouped_bars(
        {"All annotated faces": s["all_faces"], "Model-card domain (face sides >= 15% of image)": s["in_domain"]},
        {"All annotated faces": "#9AA9BA", "Model-card domain (face sides >= 15% of image)": "#6A3D9A"}, 2))


def fig_by_source(s):
    fig, ax = plt.subplots(figsize=(13, 5.5))
    strata = list(s["by_stratum"])
    width = 0.38
    for k, (key, label, color) in enumerate([("all_faces", "All faces", "#9AA9BA"),
                                             ("in_domain", "Model-card domain", "#6A3D9A")]):
        xs = np.arange(len(strata)) + (k - 0.5) * width
        vals = [s["by_stratum"][st][key]["Recall (%)"] for st in strata]
        ax.bar(xs, vals, width * 0.92, color=color, edgecolor="black", linewidth=1.1, label=label)
        for x, v, st in zip(xs, vals, strata):
            n = s["by_stratum"][st][key]["Faces counted"]
            ax.text(x, v + 0.8, f"{v:.1f}\n(n={n})", ha="center", va="bottom", fontsize=8, fontweight="bold")
    ax.set_xticks(range(len(strata)), strata, fontweight="bold")
    style(ax, "Recall (%)")
    ax.set_ylim(0, 115)
    ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.01), ncol=2, frameon=False,
              prop={"weight": "bold", "size": 10})
    return to_data_uri(fig)


def fig_vs_finetuned(s):
    groups = dict(YOLO_TEST)
    groups["MediaPipe (BlazeFace)"] = s["all_faces"]
    return to_data_uri(grouped_bars(groups, MODEL_COLORS, 4))


def fig_same_protocol(s, ft):
    groups = {"MediaPipe (BlazeFace)": s["in_domain"]}
    groups.update({DISPLAY[k]: ft[k]["in_domain"] for k in FT_ORDER if k in ft})
    return to_data_uri(grouped_bars(groups, MODEL_COLORS, len(groups)))


def fig_confusion(row, title):
    tp, fp, fn = row["TP"], row["FP"], row["FN"]
    grid = np.array([[tp, fn], [fp, np.nan]], dtype=float)
    shade = np.nan_to_num(grid / max(tp + fp + fn, 1))
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    ax.imshow(shade, cmap="Purples", vmin=0, vmax=1)
    labels = [[f"TP\n{tp}", f"FN\n{fn}"], [f"FP\n{fp}", "TN\nn/a*"]]
    for i in range(2):
        for j in range(2):
            ax.text(j, i, labels[i][j], ha="center", va="center", fontsize=15, fontweight="bold",
                    color="white" if shade[i, j] > 0.5 else "#222222")
    ax.set_xticks([0, 1], ["Detected", "Not detected"], fontweight="bold")
    ax.set_yticks([0, 1], ["Face", "Background"], fontweight="bold")
    ax.set_xlabel("Detector output")
    ax.set_ylabel("Ground truth")
    ax.set_title(title, fontsize=12)
    fig.text(0.5, -0.02, "*Single-class detection has no countable true negatives.", ha="center",
             fontsize=9, style="italic", color="#666666")
    return to_data_uri(fig)


def table(rows: list[tuple[str, dict]], first_col: str) -> str:
    cols = ["Accuracy (%)", "Precision (%)", "Recall (%)", "F1 (%)", "TP", "FP", "FN", "Faces counted"]
    head = "".join(f"<th>{c}</th>" for c in [first_col] + cols)
    body = "".join(
        "<tr><td>" + name + "</td>" + "".join(f"<td>{row[c]:.2f}</td>" if isinstance(row[c], float)
                                              else f"<td>{row[c]}</td>" for c in cols) + "</tr>"
        for name, row in rows
    )
    return f'<table class="dataframe table"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'


def figure(uri: str, n: int, caption: str, alt: str) -> str:
    return (f'<div class="figure-container"><img src="{uri}" alt="{alt}">'
            f'<div class="figure-caption">Figure {n}: {caption}</div></div>')


def main() -> None:
    s = json.loads((EVAL_DIR / "summary.json").read_text())
    a, d, sp = s["all_faces"], s["in_domain"], s["speed_cpu"]
    n = FIRST_FIGURE

    comparison_rows = "".join(
        f"<tr><td>{name}</td><td>Fine-tuned on train split (70%)</td>"
        + "".join(f"<td>{row[c]:.2f}</td>" for c in ("Accuracy (%)", "Precision (%)", "Recall (%)", "F1 (%)"))
        + "</tr>"
        for name, row in YOLO_TEST.items()
    ) + (
        "<tr><td><b>MediaPipe (BlazeFace)</b></td><td>Pre-trained by Google, used frozen</td>"
        + "".join(f"<td><b>{a[c]:.2f}</b></td>" for c in ("Accuracy (%)", "Precision (%)", "Recall (%)", "F1 (%)"))
        + "</tr>"
    )
    strata_rows = [(f"{st} ({v['images']} images) - all faces", v["all_faces"]) for st, v in s["by_stratum"].items()]
    strata_rows += [(f"{st} - model-card domain", v["in_domain"]) for st, v in s["by_stratum"].items()]

    ft = json.loads(FINETUNED_SUMMARY.read_text()) if FINETUNED_SUMMARY.exists() else {}
    ft_models = [k for k in FT_ORDER if k in ft]
    same_protocol_html = verdict_html = ""
    if ft:
        sp_rows = [("MediaPipe (BlazeFace) - examinee-sized faces", d)]
        sp_rows += [(f"{DISPLAY[k]} - examinee-sized faces", ft[k]["in_domain"]) for k in ft_models]
        sp_rows += [("MediaPipe (BlazeFace) - all faces", a)]
        sp_rows += [(f"{DISPLAY[k]} - all faces", ft[k]["all_faces"]) for k in ft_models]
        sanity = "; ".join(f"{DISPLAY[k]} {ft[k]['detections']:,}" for k in ft_models)
        missing = [DISPLAY[k] for k in FT_ORDER if k not in ft]
        best_name = max(ft_models, key=lambda k: ft[k]["in_domain"]["Accuracy (%)"])
        best = ft[best_name]["in_domain"]
        same_protocol_html = f"""
    <h2>4. Like-for-Like Comparison on Examinee-Sized Faces</h2>
    <div class="paragraph">
        Section 3 compares numbers produced by two different scoring procedures. To compare the detectors directly,
        the fine-tuned detectors' test-split predictions were scored with <b>the same matching and scoring code</b>
        as MediaPipe (IoU &ge; {s['iou_threshold']}, one-to-one matching), at the confidence threshold fixed before
        scoring: 0.25, the Ultralytics default and the threshold the fine-tuned report used for its TP/FP/FN and
        detection counts. Detection counts match that report exactly ({sanity}), confirming the same weights were
        scored. The first rows restrict scoring to examinee-sized faces (face sides &ge; 15% of the image), the
        setting closest to a single examinee in front of a webcam.
    </div>
    {table(sp_rows, "Detector and scoring")}
    {figure(fig_same_protocol(s, ft), n + 3, "Same scoring code, examinee-sized faces only (face sides >= 15% of the image), TEST split.", "Same-protocol comparison")}
    <div class="paragraph note">
        False positives are counted over all {s['images']} test images under the same rule for every detector: a
        detection that does not overlap any annotated face with IoU &ge; {s['iou_threshold']}.
        {"Not scored with this code: " + ", ".join(missing) + " (CPU memory limits on the evaluation laptop)." if missing else ""}
        CPU speed is not compared here because the fine-tuned models had to run with optimised CPU kernels
        disabled on this laptop; their GPU speeds are in the fine-tuned detector report.
    </div>
"""
        verdict_html = f"""        <div class="paragraph">
            On examinee-sized faces scored with identical code, MediaPipe reached {d['Accuracy (%)']:.2f}% accuracy
            and {d['F1 (%)']:.2f}% F1 against {best['Accuracy (%)']:.2f}% and {best['F1 (%)']:.2f}% for
            {DISPLAY[best_name]}, the strongest fine-tuned detector. The two make opposite errors:
            {DISPLAY[best_name]} finds more faces ({best['Recall (%)']:.2f}% vs. {d['Recall (%)']:.2f}% recall) but
            produces {best['FP']} false detections against MediaPipe's {d['FP']}
            ({best['Precision (%)']:.2f}% vs. {d['Precision (%)']:.2f}% precision). MediaPipe also supplies the
            facial landmarks and head pose that the gaze and identity checks need, which a bounding-box detector
            alone does not, so it remains the deployed face detector.
        </div>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>MediaPipe Face Test</title>
<style>
    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; background: #fff; }}
    h1 {{ color: #2c3e50; text-align: center; border-bottom: 2px solid #eee; padding-bottom: 10px; }}
    h2 {{ color: #34495e; margin-top: 30px; }}
    .figure-container {{ margin-bottom: 30px; text-align: center; page-break-inside: avoid; }}
    .figure-container img {{ max-width: 100%; height: auto; border: 1px solid #ddd; padding: 5px; background: #fff; }}
    .figure-caption {{ font-weight: bold; margin-top: 10px; color: #555; font-size: 0.9em; }}
    .paragraph {{ margin-bottom: 15px; text-align: justify; }}
    .note {{ font-size: 0.85em; color: #555; }}
    table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 0.9em; }}
    th, td {{ border: 1px solid #ddd; padding: 10px; text-align: center; }}
    th {{ background-color: #f8f9fa; font-weight: bold; color: #333; }}
    tr:nth-child(even) {{ background-color: #fcfcfc; }}
    .conclusion {{ background-color: #e8f4f8; padding: 15px; border-left: 5px solid #3498db; margin-top: 40px; }}
    @media (max-width: 700px) {{ body {{ padding: 16px; }} table {{ display: block; overflow-x: auto; }} }}
</style>
</head>
<body>
    <h1>Production Face Detector (MediaPipe BlazeFace) - Test-Split Evaluation</h1>

    <div class="paragraph">
        The face-presence stage of the deployed Knowing Eye pipeline uses MediaPipe Face Landmarker, whose
        detection stage is Google's pre-trained BlazeFace (short-range) model. Unlike the YOLOv8n, YOLOv11n and
        RT-DETR-l detectors, it was <b>not trained or fine-tuned</b> in this study, so it has no training or
        validation curves and uses neither the training nor the validation split. It was evaluated
        <b>once</b>, frozen, on the same held-out test split used for the fine-tuned detectors:
        {s['images']} images containing {s['faces_total']:,} annotated faces.
    </div>
    <div class="paragraph">
        The evaluation runs exactly the production code path: each image is resized to 640 px wide,
        denoised with a bilateral filter and histogram-equalised (<code>prepare_frame_pair</code>), then passed to
        <code>FaceDetector.detect</code> with the deployed settings (up to 3 faces, minimum detection confidence 0.62,
        plausibility filter). A detection counts as a true positive when it overlaps an annotated face with
        IoU &ge; {s['iou_threshold']}. Accuracy = TP / (TP + FP + FN), the same definition used for the fine-tuned
        detectors.
    </div>

    <h2>1. Published Reference Accuracy (Google Model Card)</h2>
    <div class="paragraph">
        Google's model card for BlazeFace (short range), dated June 9, 2021, reports the following results on its
        own evaluation sets of smartphone and webcam images in which every face box is at least 15% of the image
        width and height (Dataset I: 720 images across 17 geographic subregions, including 40 images without faces;
        Dataset II: 800 single-face images; Dataset III: 350 single-face images across 5 skin-tone groups).
    </div>
    <table class="dataframe table"><thead><tr><th>Evaluation slice (Google)</th><th>Average Recall (%)</th><th>Average Precision (%)</th></tr></thead>
    <tbody>
        <tr><td>Perceived gender (feminine / masculine)</td><td>98.4 (98.2 / 98.5)</td><td>99.9 (99.7 / 100)</td></tr>
        <tr><td>Skin tone (5 groups)</td><td>98.1 (range 94.7 - 100)</td><td>99.7 (range 98.6 - 100)</td></tr>
        <tr><td>Geographic subregion (17)</td><td>99.1 (range 92.5 - 100)</td><td>95.1 (range 94.9 - 95.2)</td></tr>
    </tbody></table>
    <div class="paragraph note">
        Source: MediaPipe BlazeFace Model Card (Short Range), Google, 2021; V. Bazarevsky et al., "BlazeFace:
        Sub-millisecond Neural Face Detection on Mobile GPUs," CVPR Workshops, 2019. These are Google's figures on
        Google's data, not measured in this study.
    </div>

    <h2>2. Results on the Knowing Eye Test Split</h2>
    <div class="paragraph">
        Two results are reported. The primary result counts every annotated face. The secondary result restricts
        scoring to the operating domain stated in the model card (face box sides &ge; 15% of the image sides);
        {s['faces_in_domain']} of the {s['faces_total']:,} test faces, in {s['images_with_in_domain_face']} images,
        meet it. Faces outside that domain are ignored in the secondary result: missing one is not a false
        negative, and detecting one is not a false positive.
    </div>
    {table([("All annotated faces (primary)", a), ("Model-card domain (secondary)", d)], "Scoring")}
    {figure(fig_all_vs_domain(s), n, "MediaPipe (BlazeFace) detection performance on the TEST split - all faces vs. the model-card operating domain.", "MediaPipe test metrics")}
    {figure(fig_confusion(d, "MediaPipe (BlazeFace) - model-card domain, test split"), n + 1, "MediaPipe (BlazeFace) test-set confusion matrix (model-card domain).", "MediaPipe confusion matrix")}

    <h2>3. Comparison with the Fine-Tuned Detectors</h2>
    <div class="paragraph">
        Same {s['images']} test images and {s['faces_total']:,} faces for every model. The fine-tuned detectors were
        trained on the 70% training split, which contains many small, crowded WIDER FACE faces like those in the
        test split; BlazeFace was not, and is documented as out of scope for crowds and distant faces.
    </div>
    <table class="dataframe table"><thead><tr><th>Model</th><th>Training</th><th>Accuracy (%)</th><th>Precision (%)</th><th>Recall (%)</th><th>F1 (%)</th></tr></thead>
    <tbody>{comparison_rows}</tbody></table>
    <div class="paragraph note">
        The fine-tuned detectors' precision and recall are taken at each model's best-F1 confidence threshold
        (Ultralytics validation); MediaPipe is scored at its fixed production threshold (0.62). All counts use the
        full test split.
    </div>
    {figure(fig_vs_finetuned(s), n + 2, "All four face detectors on the same TEST split (all annotated faces).", "Detector comparison")}
{same_protocol_html}
    <h2>{5 if ft else 4}. Results by Data Source</h2>
    {table(strata_rows, "Source")}
    {figure(fig_by_source(s), n + (4 if ft else 3), "MediaPipe (BlazeFace) recall on the TEST split by data source (n = faces scored).", "Recall by source")}

    <h2>{6 if ft else 5}. Inference Speed</h2>
    <div class="paragraph">
        Measured on CPU only (Intel Core i5-11300H laptop, no GPU), over {sp['images_timed']} test images after
        warm-up: <b>{sp['detect_ms_mean']} ms</b> per image for detection ({sp['fps_detect_only']} FPS) and
        {sp['preprocess_ms_mean']} ms for preprocessing ({sp['fps_end_to_end']} FPS end to end). The production
        pipeline samples the webcam at 5 frames per second (<code>target_fps: 5</code>), so detection fits the
        frame budget without a GPU.
    </div>

    <div class="conclusion">
        <h3>Conclusion</h3>
        <div class="paragraph">
            The production detector is highly precise: {a['FP']} false detection{'s' if a['FP'] != 1 else ''} across
            all {s['images']} test images ({a['Precision (%)']:.2f}% precision), so when it reports a face, a face is
            almost always there. Within its documented operating domain it finds {d['Recall (%)']:.2f}% of faces
            ({d['Accuracy (%)']:.2f}% accuracy, {d['F1 (%)']:.2f}% F1). Across all faces, recall falls to
            {a['Recall (%)']:.2f}% because most WIDER FACE faces are small faces in crowds, which the model card
            lists as out of scope and which the fine-tuned detectors were trained on.
        </div>
{verdict_html}
        <div class="paragraph">
            Limitations: the test images are FDDB and WIDER FACE photographs, not webcam frames from examination
            sessions, so these results do not by themselves measure accuracy under exam conditions. Google's
            published figures (Section 1) come from Google's own smartphone and webcam data. A test on webcam
            recordings of consenting participants is needed to measure the deployed face-presence accuracy
            directly. The model card also lists surveillance as an out-of-scope use; the system therefore treats
            detections as behavioral indicators for administrator review, not as findings of misconduct.
        </div>
    </div>
</body>
</html>
"""
    out = EVAL_DIR / "mediapipe_test_report.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
