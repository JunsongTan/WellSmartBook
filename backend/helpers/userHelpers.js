const {
    roundOne,
    safeParseJson,
    normalizeDateOnly,
    calculateAge
} =
    require('./generalHelpers');


// ======================================================
// ACTIVITY FACTORS
// ======================================================

const ACTIVITY_FACTORS = {

    'Sedentary':
        1.2,

    'Lightly Active':
        1.375,

    'Moderately Active':
        1.55,

    'Very Active':
        1.725

};


// ======================================================
// PERSONAL TARGET CALCULATION
// ======================================================

function calculatePersonalTargets({
    gender,
    dateOfBirth,
    height,
    weight,
    activityLevel,
    primaryGoal,
    goalPace
}) {

    const age =
        calculateAge(
            dateOfBirth
        );


    const numericHeight =
        Number(
            height
        );


    const numericWeight =
        Number(
            weight
        );


    const activityFactor =
        ACTIVITY_FACTORS[
            activityLevel
        ];


    if (
        age === null ||
        age < 18 ||
        !Number.isFinite(
            numericHeight
        ) ||
        !Number.isFinite(
            numericWeight
        ) ||
        !activityFactor
    ) {

        throw new Error(
            'Unable to calculate personalized nutrition targets.'
        );
    }


    // ==================================================
    // BMR
    // Mifflin-St Jeor Equation
    // ==================================================

    let bmr =
        10 *
        numericWeight +

        6.25 *
        numericHeight -

        5 *
        age;


    if (
        gender ===
        'Male'
    ) {

        bmr += 5;

    } else if (
        gender ===
        'Female'
    ) {

        bmr -= 161;

    } else {

        throw new Error(
            'Male or Female must be selected for energy calculation.'
        );
    }


    // ==================================================
    // TDEE
    // ==================================================

    const tdee =
        bmr *
        activityFactor;


    // ==================================================
    // GOAL CALORIE MULTIPLIER
    // ==================================================

    let calorieMultiplier =
        1;


    if (
        primaryGoal ===
        'Lose Weight'
    ) {

        if (
            goalPace ===
            'Gradual'
        ) {

            calorieMultiplier =
                0.90;

        } else if (
            goalPace ===
            'Moderate'
        ) {

            calorieMultiplier =
                0.85;

        } else if (
            goalPace ===
            'Faster'
        ) {

            calorieMultiplier =
                0.80;

        } else {

            throw new Error(
                'Please choose a valid weight-loss pace.'
            );
        }

    } else if (
        primaryGoal ===
        'Build Muscle'
    ) {

        if (
            goalPace ===
            'Lean Gain'
        ) {

            calorieMultiplier =
                1.05;

        } else if (
            goalPace ===
            'Standard Gain'
        ) {

            calorieMultiplier =
                1.10;

        } else {

            throw new Error(
                'Please choose a valid muscle-gain pace.'
            );
        }

    } else if (
        primaryGoal !==
        'Maintain Weight'
    ) {

        throw new Error(
            'Please choose a valid primary goal.'
        );
    }


    // ==================================================
    // DAILY CALORIE TARGET
    // ==================================================

    const dailyCalorieTarget =
        tdee *
        calorieMultiplier;


    // ==================================================
    // PROTEIN
    // ==================================================

    let proteinPerKg =
        1.2;


    if (
        primaryGoal ===
        'Lose Weight'
    ) {

        proteinPerKg =
            1.6;

    } else if (
        primaryGoal ===
        'Build Muscle'
    ) {

        proteinPerKg =
            1.8;
    }


    const proteinTarget =
        numericWeight *
        proteinPerKg;


    // ==================================================
    // FAT
    // 25% of total calories
    // ==================================================

    const fatTarget =
        (
            dailyCalorieTarget *
            0.25
        ) /
        9;


    // ==================================================
    // CARBOHYDRATES
    // ==================================================

    const remainingCalories =
        Math.max(
            0,

            dailyCalorieTarget -

            proteinTarget *
            4 -

            fatTarget *
            9
        );


    const carbsTarget =
        remainingCalories /
        4;


    // ==================================================
    // BMI
    // ==================================================

    const heightMeters =
        numericHeight /
        100;


    const bmi =
        numericWeight /
        (
            heightMeters *
            heightMeters
        );


    return {

        age,

        bmi:
            roundOne(
                bmi
            ),

        bmr:
            roundOne(
                bmr
            ),

        tdee:
            roundOne(
                tdee
            ),

        dailyCalorieTarget:
            roundOne(
                dailyCalorieTarget
            ),

        proteinTarget:
            roundOne(
                proteinTarget
            ),

        carbsTarget:
            roundOne(
                carbsTarget
            ),

        fatTarget:
            roundOne(
                fatTarget
            )

    };
}


// ======================================================
// FORMAT USER FOR FRONTEND
// ======================================================

function formatUserForClient(
    user
) {

    return {

        id:
            user.id,

        username:
            user.username,

        email:
            user.email,

        role:
            user.role,

        fullName:
            user.full_name,

        dateOfBirth:
            normalizeDateOnly(
                user.date_of_birth
            ),

        gender:
            user.gender,

        profilePicture:
            user.profile_picture,

        height:
            user.height !==
            null
                ? Number(
                    user.height
                )
                : null,

        weight:
            user.weight !==
            null
                ? Number(
                    user.weight
                )
                : null,

        activityLevel:
            user.activity_level,

        primaryGoal:
            user.primary_goal,

        targetWeight:
            user.target_weight !==
            null
                ? Number(
                    user.target_weight
                )
                : null,

        goalPace:
            user.goal_pace,

        exerciseDaysPerWeek:
            user.exercise_days_per_week,

        exerciseMinutes:
            user.exercise_minutes,

        dietaryPreference:
            user.dietary_preference,

        allergies:
            safeParseJson(
                user.allergies,
                []
            ),

        mealsPerDay:
            user.meals_per_day,

        cookingTimePreference:
            user.cooking_time_preference,

        bmi:
            user.bmi !==
            null
                ? Number(
                    user.bmi
                )
                : null,

        bmr:
            user.bmr !==
            null
                ? Number(
                    user.bmr
                )
                : null,

        tdee:
            user.tdee !==
            null
                ? Number(
                    user.tdee
                )
                : null,

        dailyCalorieTarget:
            user.daily_calorie_target !==
            null
                ? Number(
                    user.daily_calorie_target
                )
                : null,

        proteinTarget:
            user.protein_target !==
            null
                ? Number(
                    user.protein_target
                )
                : null,

        carbsTarget:
            user.carbs_target !==
            null
                ? Number(
                    user.carbs_target
                )
                : null,

        fatTarget:
            user.fat_target !==
            null
                ? Number(
                    user.fat_target
                )
                : null

    };
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    ACTIVITY_FACTORS,

    calculatePersonalTargets,

    formatUserForClient

};