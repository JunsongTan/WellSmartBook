from flask import Flask, request, jsonify
from flask_cors import CORS

from ultralytics import YOLO

from pathlib import Path
import numpy as np
import cv2


app = Flask(__name__)
CORS(app)


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent


INGREDIENT_MODEL_PATH = (
    BASE_DIR / "trofes_best_v2.pt"
)

MALAYSIAN_FOOD_MODEL_PATH = (
    BASE_DIR / "malaysian_food_best.pt"
)


# =========================================================
# LOAD MODELS
# =========================================================

print("Loading WellSmartBook AI models...")


# Ingredient detection model
ingredient_model = YOLO(
    str(INGREDIENT_MODEL_PATH)
)


# Malaysian prepared-food classification model
malaysian_food_model = YOLO(
    str(MALAYSIAN_FOOD_MODEL_PATH)
)


print("Ingredient model loaded.")
print(
    "Ingredient classes:",
    len(ingredient_model.names)
)


print("Malaysian food model loaded.")
print(
    "Malaysian food classes:",
    len(malaysian_food_model.names)
)


print(
    "Malaysian classes:",
    malaysian_food_model.names
)


# =========================================================
# IMAGE DECODING
# =========================================================

def decode_uploaded_image(file):

    image_bytes = file.read()

    np_array = np.frombuffer(
        image_bytes,
        np.uint8
    )

    image = cv2.imdecode(
        np_array,
        cv2.IMREAD_COLOR
    )

    if image is None:

        raise ValueError(
            "Unable to decode uploaded image."
        )

    return image


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    return jsonify({

        "status": "ok",

        "service":
            "WellSmartBook AI Vision Service",

        "ingredientModel":
            True,

        "malaysianFoodModel":
            True

    })


# =========================================================
# INGREDIENT SCANNER
#
# Used by:
# AI Ingredient Scanner
# =========================================================

@app.route(
    "/api/scan",
    methods=["POST"]
)
def scan_ingredients():

    try:

        if "image" not in request.files:

            return jsonify({

                "message":
                    "No image uploaded."

            }), 400


        image_file = request.files["image"]


        image = decode_uploaded_image(
            image_file
        )


        # -------------------------------------------------
        # YOLO ingredient detection
        # -------------------------------------------------

        predictions = ingredient_model.predict(

            source=image,

            imgsz=640,

            conf=0.25,

            verbose=False

        )


        detected_items = {}


        for result in predictions:

            for box in result.boxes:

                class_id = int(
                    box.cls[0]
                )

                confidence = float(
                    box.conf[0]
                )


                class_name = (
                    ingredient_model.names[
                        class_id
                    ]
                )


                normalized_name = (
                    class_name
                    .strip()
                    .lower()
                )


                # -----------------------------------------
                # Remove duplicate detections.
                #
                # Keep highest-confidence instance.
                # -----------------------------------------

                if (
                    normalized_name
                    not in detected_items
                ):

                    detected_items[
                        normalized_name
                    ] = confidence


                else:

                    detected_items[
                        normalized_name
                    ] = max(

                        detected_items[
                            normalized_name
                        ],

                        confidence

                    )


        results = []


        for (
            item,
            confidence
        ) in detected_items.items():

            results.append({

                "item":
                    item,

                "confidence":
                    round(
                        confidence,
                        4
                    )

            })


        # Highest confidence first
        results.sort(

            key=lambda x:
                x["confidence"],

            reverse=True

        )


        return jsonify({

            "success":
                True,

            "results":
                results

        })


    except Exception as error:

        print(
            "Ingredient scan error:",
            error
        )


        return jsonify({

            "success":
                False,

            "message":
                "Ingredient recognition failed.",

            "error":
                str(error)

        }), 500


# =========================================================
# MALAYSIAN FOOD CLASSIFIER
#
# Used by:
# Calorie / meal scanner
# =========================================================

@app.route(
    "/api/classify-meal",
    methods=["POST"]
)
def classify_meal():

    try:

        if "image" not in request.files:

            return jsonify({

                "message":
                    "No meal image uploaded."

            }), 400


        image_file = request.files[
            "image"
        ]


        image = decode_uploaded_image(
            image_file
        )


        # -------------------------------------------------
        # Classification
        # -------------------------------------------------

        predictions = (
            malaysian_food_model.predict(

                source=image,

                imgsz=224,

                verbose=False

            )
        )


        if len(predictions) == 0:

            return jsonify({

                "success":
                    False,

                "message":
                    "No prediction returned."

            }), 400


        result = predictions[0]


        probs = result.probs


        if probs is None:

            return jsonify({

                "success":
                    False,

                "message":
                    "Classification model returned no probabilities."

            }), 500


        # -------------------------------------------------
        # TOP-1
        # -------------------------------------------------

        top1_id = int(
            probs.top1
        )


        top1_confidence = float(
            probs.data[
                top1_id
            ]
        )


        top1_name = (
            malaysian_food_model.names[
                top1_id
            ]
        )


        # -------------------------------------------------
        # TOP-3
        # -------------------------------------------------

        top3 = []


        for class_id in probs.top5[:3]:

            class_id = int(
                class_id
            )


            class_name = (
                malaysian_food_model.names[
                    class_id
                ]
            )


            confidence = float(
                probs.data[
                    class_id
                ]
            )


            top3.append({

                "item":
                    class_name,

                "confidence":
                    round(
                        confidence,
                        4
                    )

            })


        # -------------------------------------------------
        # HUMAN-IN-THE-LOOP THRESHOLD
        # -------------------------------------------------

        CONFIDENCE_THRESHOLD = 0.65


        confident = (
            top1_confidence >=
            CONFIDENCE_THRESHOLD
        )


        if confident:

            status = (
                "recognized"
            )

        else:

            status = (
                "uncertain"
            )


        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return jsonify({

            "success":
                True,

            "status":
                status,

            "prediction": {

                "item":
                    top1_name,

                "confidence":
                    round(
                        top1_confidence,
                        4
                    )

            },

            "top3":
                top3,

            "needsUserConfirmation":
                not confident

        })


    except Exception as error:

        print(
            "Meal classification error:",
            error
        )


        return jsonify({

            "success":
                False,

            "message":
                "Meal recognition failed.",

            "error":
                str(error)

        }), 500


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    print()
    print(
        "===================================="
    )

    print(
        " WellSmartBook AI Vision Service"
    )

    print(
        "===================================="
    )

    print(
        "Ingredient API:"
    )

    print(
        "POST http://127.0.0.1:8000/api/scan"
    )

    print()
    print(
        "Meal Classification API:"
    )

    print(
        "POST http://127.0.0.1:8000/api/classify-meal"
    )

    print(
        "===================================="
    )


    app.run(

        host="0.0.0.0",

        port=8000,

        debug=True

    )