
export function getPasswordChecks(value) {
    const password =
        typeof value === 'string' ? value : '';

    const byteLength =
        new TextEncoder().encode(password).length;

    return [
        {
            label: 'At least 12 characters',
            valid: password.length >= 12
        },
        {
            label: 'One uppercase letter (A–Z)',
            valid: /[A-Z]/.test(password)
        },
        {
            label: 'One lowercase letter (a–z)',
            valid: /[a-z]/.test(password)
        },
        {
            label: 'One number (0–9)',
            valid: /[0-9]/.test(password)
        },
        {
            label: 'One symbol (e.g. @, !, #)',
            valid: /[^A-Za-z0-9\s]/.test(password)
        },
        {
            label: 'No more than 72 UTF-8 bytes',
            valid: byteLength <= 72
        }
    ];
}

export function isStrongPassword(password) {
    return (
        typeof password === 'string' &&
        getPasswordChecks(password).every(
            check => check.valid
        )
    );
}

export default function PasswordChecklist({
    password = ''
}) {
    const checks = getPasswordChecks(password);

    return (
        <div className="ws-password-checklist">
            <style>{passwordStyles}</style>

            <strong>Password requirements</strong>

            <ul>
                {checks.map(check => (
                    <li
                        key={check.label}
                        className={
                            check.valid ? 'valid' : ''
                        }
                    >
                        <span aria-hidden="true">
                            {check.valid ? '✓' : '○'}
                        </span>

                        {check.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const passwordStyles = `
.ws-password-checklist {
    width: 100%;
    background: #f6f9ff;
    border: 1px solid #e0eafa;
    border-radius: 10px;
    padding: 12px 14px;
    color: #475569;
    font-family: inherit;
}

.ws-password-checklist > strong {
    display: block;
    font-size: 12px;
    margin-bottom: 9px;
    color: #263a58;
}

.ws-password-checklist ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 7px 12px;
}

.ws-password-checklist li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 11px;
    line-height: 1.45;
}

.ws-password-checklist li span {
    min-width: 12px;
    color: #8a98ab;
    font-weight: 800;
}

.ws-password-checklist li.valid,
.ws-password-checklist li.valid span {
    color: #087645;
}

@media (max-width: 520px) {
    .ws-password-checklist ul {
        grid-template-columns: 1fr;
    }
}
`;
