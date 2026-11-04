import {
    useNavigate
} from 'react-router-dom';


export default function RegisterChoice() {

    const navigate =
        useNavigate();


    return (
        <div className="register-choice-page">

            <style>
                {choiceCss}
            </style>


            <div className="choice-container">

                <button
                    type="button"
                    className="choice-logo"
                    onClick={() =>
                        navigate(
                            '/login'
                        )
                    }
                >
                    <div>
                        ♥
                    </div>

                    <section>
                        <strong>
                            WellSmartBook
                        </strong>

                        <span>
                            Your Health Companion
                        </span>
                    </section>
                </button>


                <div className="choice-heading">

                    <span>
                        GET STARTED
                    </span>

                    <h1>
                        Create your WellSmartBook account
                    </h1>

                    <p>
                        Choose how you want to use WellSmartBook.
                    </p>

                </div>


                <div className="account-choice-grid">

                    <button
                        type="button"
                        className="account-choice-card"
                        onClick={() =>
                            navigate(
                                '/register/user'
                            )
                        }
                    >

                        <div className="choice-icon user">
                            ♥
                        </div>


                        <div className="choice-card-copy">

                            <span className="choice-type">
                                PERSONAL HEALTH
                            </span>

                            <h2>
                                Register as User
                            </h2>

                            <p>
                                Track meals, receive personalized calorie and macro targets, discover recipes and book coaching sessions.
                            </p>


                            <div className="choice-features">

                                <span>
                                    ✓ Personalized nutrition targets
                                </span>

                                <span>
                                    ✓ AI meal & ingredient scanner
                                </span>

                                <span>
                                    ✓ Recipe recommendations
                                </span>

                                <span>
                                    ✓ Fitness coaching bookings
                                </span>

                            </div>

                        </div>


                        <strong className="choice-arrow">
                            →
                        </strong>

                    </button>


                    <button
                        type="button"
                        className="account-choice-card coach"
                        onClick={() =>
                            navigate(
                                '/register/coach'
                            )
                        }
                    >

                        <div className="choice-icon coach">
                            🏋
                        </div>


                        <div className="choice-card-copy">

                            <span className="choice-type">
                                FITNESS PROFESSIONAL
                            </span>

                            <h2>
                                Register as Coach
                            </h2>

                            <p>
                                Create a professional coaching profile, publish availability at registered gyms and manage client sessions.
                            </p>


                            <div className="choice-features">

                                <span>
                                    ✓ Professional coach profile
                                </span>

                                <span>
                                    ✓ Choose registered gym locations
                                </span>

                                <span>
                                    ✓ Publish working availability
                                </span>

                                <span>
                                    ✓ Manage future client sessions
                                </span>

                            </div>

                        </div>


                        <strong className="choice-arrow">
                            →
                        </strong>

                    </button>

                </div>


                <div className="choice-login">

                    Already have an account?

                    <button
                        type="button"
                        onClick={() =>
                            navigate(
                                '/login'
                            )
                        }
                    >
                        Log in
                    </button>

                </div>

            </div>

        </div>
    );
}


const choiceCss = `

* {
    box-sizing: border-box;
}

.register-choice-page {
    min-height: 100vh;
    padding: 35px 24px 60px;
    background:
        radial-gradient(
            circle at top right,
            #e6f0ff 0,
            transparent 32%
        ),
        #f7f9fc;
}

.choice-container {
    width: min(950px,100%);
    margin: auto;
}

.choice-logo {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
}

.choice-logo > div {
    width: 45px;
    height: 45px;
    border-radius: 12px;
    background: #0759d9;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
}

.choice-logo section strong {
    display: block;
    color: #0759d9;
    font-size: 19px;
}

.choice-logo section span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 8px;
}

.choice-heading {
    margin-top: 75px;
    text-align: center;
}

.choice-heading > span {
    color: #0759d9;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
}

.choice-heading h1 {
    margin: 8px auto;
    color: #172033;
    font-size: 32px;
}

.choice-heading p {
    margin: 0;
    color: #64748b;
    font-size: 11px;
}

.account-choice-grid {
    display: grid;
    grid-template-columns: repeat(2,1fr);
    gap: 18px;
    margin-top: 35px;
}

.account-choice-card {
    position: relative;
    min-height: 355px;
    padding: 28px;
    border: 1px solid #dce4ef;
    border-radius: 20px;
    background: white;
    text-align: left;
    cursor: pointer;
    transition:
        transform .2s ease,
        border-color .2s ease,
        box-shadow .2s ease;
}

.account-choice-card:hover {
    transform: translateY(-4px);
    border-color: #0759d9;
    box-shadow: 0 18px 45px rgba(15,23,42,.08);
}

.account-choice-card.coach:hover {
    border-color: #059669;
}

.choice-icon {
    width: 56px;
    height: 56px;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 23px;
}

.choice-icon.user {
    background: #e8f1ff;
    color: #0759d9;
}

.choice-icon.coach {
    background: #e7f8ef;
    color: #087b44;
}

.choice-card-copy {
    margin-top: 22px;
}

.choice-type {
    color: #0759d9;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .8px;
}

.account-choice-card.coach .choice-type {
    color: #087b44;
}

.choice-card-copy h2 {
    margin: 6px 0;
    color: #172033;
    font-size: 21px;
}

.choice-card-copy > p {
    min-height: 48px;
    margin: 0;
    color: #64748b;
    font-size: 9px;
    line-height: 1.7;
}

.choice-features {
    display: grid;
    gap: 9px;
    margin-top: 22px;
}

.choice-features span {
    color: #475569;
    font-size: 9px;
}

.choice-arrow {
    position: absolute;
    right: 27px;
    bottom: 24px;
    color: #0759d9;
    font-size: 20px;
}

.account-choice-card.coach .choice-arrow {
    color: #087b44;
}

.choice-login {
    margin-top: 28px;
    text-align: center;
    color: #64748b;
    font-size: 10px;
}

.choice-login button {
    margin-left: 5px;
    padding: 0;
    border: 0;
    background: transparent;
    color: #0759d9;
    cursor: pointer;
    font-weight: 800;
}

@media(max-width: 720px) {

    .account-choice-grid {
        grid-template-columns: 1fr;
    }

    .choice-heading {
        margin-top: 45px;
    }
}

`;