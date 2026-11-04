
from pathlib import Path
import csv
from ultralytics import YOLO

# ==========================================
# STEP 2.12.1F
# COMPARE MEAL AND INGREDIENT MODELS
# ==========================================

BASE = Path(__file__).resolve().parent

MEAL_MODEL = BASE / "malaysian_food_best.pt"
INGREDIENT_MODEL = BASE / "trofes_best_v2.pt"

TEST_DIR = BASE / "test_meals"
CSV_PATH = BASE / "ingredient_gate_results.csv"

GROUPS = (
    "nasi_lemak",
    "satay",
    "unknown"
)

SUFFIXES = {
    ".jpg", ".jpeg", ".png", ".webp"
}

print("Loading both YOLO models...")

meal_model = YOLO(str(MEAL_MODEL))
ingredient_model = YOLO(str(INGREDIENT_MODEL))

print("Ingredient model task:", ingredient_model.task)
print("Ingredient classes:", len(ingredient_model.names))

rows = []

for actual in GROUPS:

    folder = TEST_DIR / actual

    if not folder.is_dir():
        print("Missing test folder:", folder)
        continue

    images = sorted(
        p for p in folder.iterdir()
        if p.is_file()
        and p.suffix.lower() in SUFFIXES
    )

    print(f"\n{actual}: {len(images)} image(s)")

    for path in images:

        # ==================================
        # MODEL 1: PREPARED FOOD
        # ==================================

        meal_result = meal_model.predict(
            source=str(path),
            imgsz=224,
            verbose=False
        )[0]

        meal_probs = meal_result.probs

        if meal_probs is None:
            print(
                "No classification:",
                path.name
            )
            continue

        top_idx = int(meal_probs.top1)

        meal_name = str(
            meal_model.names[top_idx]
        )

        meal_score = float(
            meal_probs.data[top_idx]
        ) * 100

        # ==================================
        # MODEL 2: INGREDIENT DETECTOR
        # ==================================

        detection_result = ingredient_model.predict(
            source=str(path),
            imgsz=640,
            conf=0.25,
            verbose=False
        )[0]

        detections = []

        for box in detection_result.boxes:

            class_idx = int(box.cls[0])

            label = str(
                ingredient_model.names[class_idx]
            )

            confidence = float(
                box.conf[0]
            ) * 100

            detections.append(
                (label, confidence)
            )

        detections.sort(
            key=lambda item: item[1],
            reverse=True
        )

        top_detections = ", ".join(
            f"{label} ({score:.1f}%)"
            for label, score in detections[:5]
        )

        # ==================================
        # DISPLAY THE COMPARISON
        # ==================================

        print(f"\nImage: {path.name}")

        print(
            f"Meal prediction: "
            f"{meal_name} ({meal_score:.2f}%)"
        )

        print(
            f"Ingredient detections: "
            f"{len(detections)}"
        )

        print(
            "Top ingredients:",
            top_detections or "none"
        )

        # ==================================
        # SAVE TEST RESULT
        # ==================================

        rows.append({
            "actual_group": actual,
            "filename": path.name,
            "meal_prediction": meal_name,
            "meal_confidence_percent": round(
                meal_score, 2
            ),
            "ingredient_detection_count": len(
                detections
            ),
            "top_ingredient_detections":
                top_detections or "none"
        })

# ==========================================
# EXPORT CSV
# ==========================================

if rows:

    with CSV_PATH.open(
        "w",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=list(rows[0].keys())
        )

        writer.writeheader()
        writer.writerows(rows)

    print("\nTest completed.")
    print("Results saved to:", CSV_PATH)

else:
    print("\nNo valid images found.")
