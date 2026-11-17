import React, { useState } from 'react';
import { Coffee, Github, Bug, Scale } from 'lucide-react';
import logo from '../assets/logo.svg';
import pkg from '../../package.json';

// Même compte PayPal que le projet Cerbere (même auteur).
const PAYPAL_DONATE = (amount) =>
    `https://www.paypal.com/donate/?business=GL7NR4F2YHUN2&no_recurring=0&currency_code=EUR${amount ? `&amount=${amount}` : ''}`;

const GITHUB_URL = 'https://github.com/ArchNext/The-Scrybe';

const AboutPanel = ({ t }) => {
    const [amount, setAmount] = useState(5);
    return (
        <div className="about-panel fade-in">
            <div className="about-hero">
                <img src={logo} alt="The Scrybe" className="about-logo" />
                <h2>The Scrybe</h2>
                <span className="about-version">
                    {t('about_version')} {pkg.version}
                </span>
                <p className="about-tagline">{t('about_tagline')}</p>
            </div>

            <div className="setting-group">
                <h3>{t('about_story_title')}</h3>
                <p className="about-text">{t('about_story')}</p>
            </div>
            <div className="setting-group">
                <h3>{t('about_privacy_title')}</h3>
                <p className="about-text">{t('about_privacy')}</p>
            </div>
            <div className="setting-group">
                <h3>{t('about_honesty_title')}</h3>
                <p className="about-text">{t('about_honesty')}</p>
            </div>
            <div className="setting-group">
                <h3>{t('about_oss_title')}</h3>
                <p className="about-text">{t('about_oss')}</p>
            </div>
            <div className="setting-group">
                <h3>{t('about_author_title')}</h3>
                <p className="about-text">{t('about_author')}</p>
            </div>

            <div className="about-donate">
                <h3>
                    <Coffee size={18} /> {t('about_coffee_title')}
                </h3>
                <p className="about-text">{t('about_coffee_sub')}</p>
                <div className="donate-amounts">
                    {[3, 5, 10].map((n) => (
                        <button
                            key={n}
                            className={`donate-amount ${amount === n ? 'active' : ''}`}
                            onClick={() => setAmount(n)}
                        >
                            {n} €
                        </button>
                    ))}
                    <button
                        className={`donate-amount ${amount === 0 ? 'active' : ''}`}
                        onClick={() => setAmount(0)}
                    >
                        {t('about_coffee_custom')}
                    </button>
                </div>
                <a
                    className="donate-submit"
                    href={PAYPAL_DONATE(amount)}
                    target="_blank"
                    rel="noreferrer"
                >
                    <Coffee size={16} />
                    {amount > 0
                        ? `${t('about_coffee_btn')} — ${amount} €`
                        : t('about_coffee_btn')}
                </a>
                <p className="donate-secure">{t('about_coffee_secure')}</p>
                <p className="donate-thanks">{t('about_coffee_thanks')}</p>
            </div>

            <div className="about-links">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                    <Github size={15} /> {t('about_sources')}
                </a>
                <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
                    <Bug size={15} /> {t('about_issue')}
                </a>
                <span className="about-license">
                    <Scale size={15} /> {t('about_license')}
                </span>
            </div>
        </div>
    );
};

export default AboutPanel;
