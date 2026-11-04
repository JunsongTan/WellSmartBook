
from pathlib import Path
from ultralytics import YOLO
import csv

# ==========================================
# STEP 2.12.1E
# TEST MALAYSIAN FOOD CLASSIFICATION MODEL
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "malaysian_food_best.pt"
TEST_FOLDER = BASE_DIR / "test_meals"
OUTPUT_FILE = BASE_DIR / "meal_test_results.csv"

TEST_CLASSES = [
    "nasi_lemak",
    "satay",
    "unknown"
]

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp"
}

print("=" * 50)
print("WellSmartBook - Food Recognition Test")
print("=" * 50)

model = YOLO(str(MODEL_PATH))

results = []

for actual_class in TEST_CLASSES:

    folder = TEST_FOLDER / actual_class

    if not folder.exists():
        print(f"Folder missing: {folder}")
        continue

    images = sorted(
        p for p in folder.iterdir()
        if p.is_file()
        and p.suffix.lower() in IMAGE_EXTENSIONS
    )

    print(f"\nTEST GROUP: {actual_class}")
    print(f"Images: {len(images)}")

    for image_path in images:

        predictions = model.predict(
            source=str(image_path),
            imgsz=224,
            verbose=False
        )

        if not predictions or predictions[0].probs is None:
            print(f"Unable to classify: {image_path.name}")
            continue

        probs = predictions[0].probs

        top_ids = [
            int(class_id)
            for class_id in probs.top5[:3]
        ]

        predicted_class = model.names[top_ids[0]]

        confidence = float(
            probs.data[top_ids[0]]
        )

        second_confidence = (
            float(probs.data[top_ids[1]])
            if len(top_ids) > 1
            else 0.0
        )

        margin = confidence - second_confidence

        correct = (
            "NOT SUPPORTED"
            if actual_class == "unknown"
            else (
                "YES"
                if predicted_class == actual_class
                else "NO"
            )
        )

        print(f"\nImage: {image_path.name}")
        print(f"Actual category: {actual_class}")
        print(f"Prediction: {predicted_class}")
        print(f"Confidence: {confidence * 100:.2f}%")
        print(f"Top-two margin: {margin * 100:.2f}%")
        print(f"Correct: {correct}")

        print("Top 3 predictions:")

        for class_id in top_ids:
            name = model.names[class_id]
            score = float(probs.data[class_id])

            print(f"  {name}: {score * 100:.2f}%")

        results.append({
            "image": image_path.name,
            "actual_category": actual_class,
            "predicted_category": predicted_class,
            "confidence_percent": round(
                confidence * 100, 2
            ),
            "top_two_margin_percent": round(
                margin * 100, 2
            ),
            "correct": correct
        })


# ==========================================
# EXPORT RESULTS TO CSV
# ==========================================

if results:

    with open(
        OUTPUT_FILE,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=list(results[0].keys())
        )

        writer.writeheader()
        writer.writerows(results)

    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)

    known = [
        r for r in results
        if r["actual_category"] != "unknown"
    ]

    unknown = [
        r for r in results
        if r["actual_category"] == "unknown"
    ]

    known_correct = sum(
        r["correct"] == "YES"
        for r in known
    )

    high_confidence_unknown = sum(
        r["confidence_percent"] >= 90
        for r in unknown
    )

    print(f"Total tested: {len(results)}")

    if known:
        print(
            f"Known food accuracy (small test): "
            f"{known_correct}/{len(known)}"
        )

    print(f"Unknown images tested: {len(unknown)}")

    print(
        "Unknown images with >=90% confidence: "
        f"{high_confidence_unknown}/{len(unknown)}"
    )

    print(f"\nResults saved to: {OUTPUT_FILE}")

else:
    print("\nNo valid test images found.")
