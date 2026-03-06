"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const BLACK_LOGO_PATH = "/branding/logo-black-mark.png";
const BLACK_LOGO_ALT = "Orfane Real Estate logo";
type LandingLanguage = "en" | "so";
type GoogleLanguage = "en" | "so" | "ar";
const GOOGLE_TRANSLATE_SCRIPT_ID = "google-translate-script";
const GOOGLE_TRANSLATE_STORAGE_KEY = "google_translate_language";
const LANDING_IMAGE_PATHS = {
  hero: "/images/landing/hero/hero.jpg",
  twoBedMain: "/images/landing/apartments/2bed/main.jpg",
  twoBedLivingRoom: "/images/landing/apartments/2bed/living-room.jpg",
  twoBedKitchen: "/images/landing/apartments/2bed/kitchen.jpg",
  twoBedBathroom: "/images/landing/apartments/2bed/bathroom.jpg",
  threeBedMain: "/images/landing/apartments/3bed/main.jpg",
  threeBedLivingRoom: "/images/landing/apartments/3bed/living-room.png",
  threeBedKitchen: "/images/landing/apartments/3bed/kitchen.jpg",
  threeBedBathroom: "/images/landing/apartments/3bed/bathroom.jpg",
};
const LANDING_GALLERY_IMAGES = [
  { src: LANDING_IMAGE_PATHS.twoBedLivingRoom, alt: "2 bedroom living room" },
  { src: LANDING_IMAGE_PATHS.twoBedBathroom, alt: "2 bedroom bathroom" },
  { src: LANDING_IMAGE_PATHS.threeBedLivingRoom, alt: "3 bedroom living room" },
  { src: LANDING_IMAGE_PATHS.threeBedKitchen, alt: "3 bedroom kitchen" },
];

type GoogleTranslateElementConstructor = {
  new(
    options: {
      pageLanguage: string;
      includedLanguages?: string;
      autoDisplay?: boolean;
      layout?: unknown;
    },
    elementId: string,
  ): unknown;
  InlineLayout?: {
    SIMPLE?: unknown;
  };
};

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement?: GoogleTranslateElementConstructor;
      };
    };
  }
}

function isGoogleLanguage(value: string | null | undefined): value is GoogleLanguage {
  return value === "en" || value === "so" || value === "ar";
}

function readGoogleTranslateCookie(): GoogleLanguage | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return null;
  const parts = decodeURIComponent(match[1]).split("/").filter(Boolean);
  const target = parts[1] ?? null;
  return isGoogleLanguage(target) ? target : null;
}

function applyGoogleTranslateLanguage(language: GoogleLanguage) {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const cookieValue = `/en/${language}`;
  document.cookie = `googtrans=${cookieValue};path=/`;

  const host = window.location.hostname;
  if (host.includes(".")) {
    document.cookie = `googtrans=${cookieValue};path=/;domain=${host}`;
  }

  const combo = document.querySelector<HTMLSelectElement>("#google_translate_element select.goog-te-combo");
  if (!combo) return;

  if (combo.value !== language) {
    combo.value = language;
    combo.dispatchEvent(new Event("change"));
  }
}

const LANDING_TRANSLATIONS: Record<LandingLanguage, {
  languageLabel: string;
  languageEnglish: string;
  languageSomali: string;
  navHome: string;
  navFeatures: string;
  navGallery: string;
  nav2Bedroom: string;
  nav3Bedroom: string;
  navContact: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  twoBedLabel: string;
  twoBedShort: string;
  twoBedCaption: string;
  twoBedCta: string;
  threeBedLabel: string;
  threeBedShort: string;
  threeBedCaption: string;
  threeBedCta: string;
  galleryTitle: string;
  highlightsTitle: string;
  highlights: Array<{ icon: string; title: string; desc: string }>;
  contactTitle: string;
  contactSubtitle: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  interestedIn: string;
  optionTwoBed: string;
  optionThreeBed: string;
  optionGeneral: string;
  message: string;
  sendMessage: string;
  footerRights: string;
  privacy: string;
  terms: string;
}> = {
  en: {
    languageLabel: "Language",
    languageEnglish: "English",
    languageSomali: "Somali",
    navHome: "Home",
    navFeatures: "Features",
    navGallery: "Gallery",
    nav2Bedroom: "2-Bedroom",
    nav3Bedroom: "3-Bedroom",
    navContact: "Contact",
    heroTitle: "Premium\nApartments\nfor Rent",
    heroSubtitle: "Luxuriously designed 2-bedroom and 3-bedroom apartments available now.",
    heroCta: "Schedule a Viewing",
    twoBedLabel: "2-Bedroom Apartments",
    twoBedShort: "Spacious 2-bedroom, 2-bathroom units with modern finishes",
    twoBedCaption:
      "Spacious 2-bedroom, 2-bathroom units with modern finishes throughout. Perfect for couples or small families seeking comfort and style.",
    twoBedCta: "Explore 2-Bedroom",
    threeBedLabel: "3-Bedroom Apartments",
    threeBedShort: "Elegant 3-bedroom, 2-bathroom units perfect for families",
    threeBedCaption:
      "Elegant 3-bedroom, 2-bathroom units with premium finishes throughout. Ideal for families who value space and sophistication.",
    threeBedCta: "Explore 3-Bedroom",
    galleryTitle: "Apartment Features",
    highlightsTitle: "What's Included",
    highlights: [
      { icon: "🛁", title: "Modern Bathrooms", desc: "Floor-to-ceiling marble tiles, rainfall showers, and premium fixtures." },
      { icon: "🍳", title: "Fitted Kitchen", desc: "High-spec appliances, ample storage, and contemporary cabinetry." },
      { icon: "🌇", title: "City Views", desc: "Large windows with natural light and panoramic views throughout." },
      { icon: "🔒", title: "Secure Building", desc: "24/7 access control, CCTV, and on-site management." },
    ],
    contactTitle: "Contact Us",
    contactSubtitle: "Get in touch to schedule a viewing or ask questions about availability.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    phone: "Phone number",
    interestedIn: "Interested in...",
    optionTwoBed: "2-Bedroom Apartment",
    optionThreeBed: "3-Bedroom Apartment",
    optionGeneral: "General Enquiry",
    message: "Your message...",
    sendMessage: "Send Message",
    footerRights: "Orfane Real Estate. All rights reserved.",
    privacy: "Privacy",
    terms: "Terms",
  },
  so: {
    languageLabel: "Luqad",
    languageEnglish: "Ingiriisi",
    languageSomali: "Soomaali",
    navHome: "Bogga Hore",
    navFeatures: "Astaamo",
    navGallery: "Sawirro",
    nav2Bedroom: "2-Qol Jiif",
    nav3Bedroom: "3-Qol Jiif",
    navContact: "La Xiriir",
    heroTitle: "Guryo Casri ah\noo\nKirro ah",
    heroSubtitle: "Guryo 2-qol iyo 3-qol ah oo si heer sare ah loo naqshadeeyey, hadda diyaar ah.",
    heroCta: "Qabso Booqasho",
    twoBedLabel: "Guryo 2-Qol Jiif ah",
    twoBedShort: "Unugyo waasac ah oo leh 2 qol jiif, 2 musqulood iyo dhameystir casri ah",
    twoBedCaption:
      "Unugyo waasac ah oo leh 2 qol jiif iyo 2 musqulood, kuna dhammaaday naqshad casri ah. Ku habboon lammaanaha ama qoysaska yaryar ee raadinaya raaxo iyo qurux.",
    twoBedCta: "Daawo 2-Qol Jiif",
    threeBedLabel: "Guryo 3-Qol Jiif ah",
    threeBedShort: "Unugyo qurux badan oo leh 3 qol jiif, 2 musqulood, kuna habboon qoysaska",
    threeBedCaption:
      "Unugyo qurux badan oo leh 3 qol jiif iyo 2 musqulood, kuna dhammaaday tayo sare. Ku habboon qoysaska jecel meel ballaaran iyo heer sare.",
    threeBedCta: "Daawo 3-Qol Jiif",
    galleryTitle: "Astaamaha Guryaha",
    highlightsTitle: "Waxa Ku Jira",
    highlights: [
      { icon: "🛁", title: "Musqulo Casri ah", desc: "Darbiyo marmar ah, qubays roobaad leh, iyo qalab tayo sare leh." },
      { icon: "🍳", title: "Jiko Qalabaysan", desc: "Qalab casri ah, kaydin ku filan, iyo armaajooyin qurux badan." },
      { icon: "🌇", title: "Muuqaal Magaalo", desc: "Daaqado waaweyn oo iftiin dabiici ah iyo muuqaal furan leh." },
      { icon: "🔒", title: "Dhisme Ammaan ah", desc: "Amni 24/7, CCTV, iyo maamul goobta jooga." },
    ],
    contactTitle: "Nala Soo Xiriir",
    contactSubtitle: "Nala soo xiriir si aad u qabsato booqasho ama aad u weydiiso helitaan.",
    firstName: "Magaca hore",
    lastName: "Magaca dambe",
    email: "Cinwaanka iimaylka",
    phone: "Lambarka telefoonka",
    interestedIn: "Waxaan daneynayaa...",
    optionTwoBed: "Guri 2-Qol Jiif ah",
    optionThreeBed: "Guri 3-Qol Jiif ah",
    optionGeneral: "Weydiin Guud",
    message: "Fariintaada...",
    sendMessage: "Dir Farriin",
    footerRights: "Orfane Real Estate. Dhammaan xuquuqdu way dhowran tahay.",
    privacy: "Asturnaanta",
    terms: "Shuruudaha",
  },
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [googleLanguage, setGoogleLanguage] = useState<GoogleLanguage>("en");
  const [googleLanguageReady, setGoogleLanguageReady] = useState(false);
  const t = LANDING_TRANSLATIONS.en;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.lang = "en";
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(GOOGLE_TRANSLATE_STORAGE_KEY);
    const initialLanguage = isGoogleLanguage(stored) ? stored : (readGoogleTranslateCookie() ?? "en");
    setGoogleLanguage(initialLanguage);
    setGoogleLanguageReady(true);
  }, []);

  useEffect(() => {
    if (!googleLanguageReady) return;
    window.localStorage.setItem(GOOGLE_TRANSLATE_STORAGE_KEY, googleLanguage);
    applyGoogleTranslateLanguage(googleLanguage);
  }, [googleLanguage, googleLanguageReady]);

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      const TranslateElement = window.google?.translate?.TranslateElement;
      if (!TranslateElement) return;

      const container = document.getElementById("google_translate_element");
      if (!container || container.childElementCount > 0) return;

      new TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,so,ar",
          autoDisplay: false,
          layout: TranslateElement.InlineLayout?.SIMPLE,
        },
        "google_translate_element",
      );

      const saved = window.localStorage.getItem(GOOGLE_TRANSLATE_STORAGE_KEY);
      const preferred = isGoogleLanguage(saved) ? saved : (readGoogleTranslateCookie() ?? "en");
      window.setTimeout(() => applyGoogleTranslateLanguage(preferred), 0);
    };

    if (window.google?.translate?.TranslateElement) {
      window.googleTranslateElementInit();
    } else if (!document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      delete window.googleTranslateElementInit;
    };
  }, []);

  const handleGoogleLanguageChange = (nextValue: string) => {
    if (!isGoogleLanguage(nextValue)) return;
    setGoogleLanguage(nextValue);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy: #1e2a3a;
          --navy-light: #2d3f54;
          --white: #ffffff;
          --off-white: #f8f8f8;
          --gray: #6b7280;
          --light-gray: #e5e7eb;
          --text: #111827;
          --nav-height: 92px;
        }

        html { scroll-behavior: smooth; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--white);
          color: var(--text);
          overflow-x: hidden;
        }

        /* NAV */
        nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: var(--white);
          border-bottom: 1px solid var(--light-gray);
          padding: 0 30px;
          height: var(--nav-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: box-shadow 0.3s;
        }
        nav.scrolled { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 16px;
          text-decoration: none;
          color: var(--text);
        }
        .logo-icon {
          width: 84px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 0;
          flex-shrink: 0;
          background: transparent;
          border: none;
          box-shadow: none;
        }
        .logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          transform: translateX(-2px);
        }
        .logo-text {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(22px, 2.3vw, 28px);
          letter-spacing: 0.01em;
          color: var(--text);
          white-space: nowrap;
          line-height: 1;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-language {
          min-width: 112px;
          height: 38px;
          padding: 0 12px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          background: white;
          color: #0f172a;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
        }
        .nav-language:focus {
          border-color: var(--navy);
        }

        .google-translate-hidden {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }

        .goog-te-banner-frame.skiptranslate,
        iframe.goog-te-banner-frame {
          display: none !important;
        }

        body.skiptranslate {
          top: 0 !important;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 26px;
          list-style: none;
        }
        .nav-links a {
          font-size: 13px;
          font-weight: 400;
          color: var(--text);
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: var(--navy); }

        @media (max-width: 1200px) {
          nav { padding: 0 18px; }
          .logo-text { font-size: 24px; }
          .nav-links { gap: 16px; }
          .nav-contact-btn { padding: 8px 14px; }
        }

        .nav-contact-btn {
          padding: 8px 22px;
          background: transparent;
          border: 1.5px solid var(--navy);
          color: var(--navy);
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 4px;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .nav-contact-btn:hover { background: var(--navy); color: white; }

        /* HERO */
        .hero {
          margin-top: var(--nav-height);
          position: relative;
          height: 520px;
          overflow: hidden;
        }
        .hero-bg {
          position: absolute;
          inset: 0;
          background: #d9e0e6;
        }
        .hero-image {
          object-fit: cover;
          object-position: center;
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            rgba(255,255,255,0.05) 0%,
            rgba(255,255,255,0.6) 42%,
            rgba(255,255,255,0.1) 100%
          );
        }
        .hero-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 8% 0 44%;
        }
        .hero-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(38px, 5.5vw, 64px);
          font-weight: 400;
          line-height: 1.08;
          color: var(--navy);
          margin-bottom: 18px;
          white-space: pre-line;
        }
        .hero-sub {
          font-size: 16px;
          font-weight: 300;
          line-height: 1.65;
          color: #374151;
          margin-bottom: 32px;
          max-width: 360px;
        }
        .hero-btn {
          display: inline-block;
          padding: 14px 32px;
          background: var(--navy);
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          border-radius: 4px;
          text-decoration: none;
          transition: background 0.25s, transform 0.2s;
          align-self: flex-start;
        }
        .hero-btn:hover { background: var(--navy-light); transform: translateY(-2px); }

        /* APARTMENTS */
        .apartments {
          padding: 72px 48px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 56px;
        }
        .apt-type-label {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text);
          margin-bottom: 8px;
        }
        .apt-type-desc {
          font-size: 14px;
          font-weight: 300;
          color: var(--gray);
          margin-bottom: 22px;
          line-height: 1.6;
        }
        .apt-img-single {
          width: 100%;
          aspect-ratio: 4/3;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #d4dae0 0%, #c2cad2 100%);
          position: relative;
        }
        .apt-img-double {
          width: 100%;
          aspect-ratio: 4/3;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 4px;
          margin-bottom: 16px;
          border-radius: 2px;
          overflow: hidden;
        }
        .apt-img-cell {
          background: linear-gradient(135deg, #d4dae0 0%, #c2cad2 100%);
          position: relative;
        }
        .apt-img-cell:first-child { grid-row: span 2; }
        .section-image {
          object-fit: cover;
          object-position: center;
        }
        .apt-caption {
          font-size: 13px;
          font-weight: 300;
          color: var(--gray);
          margin-bottom: 20px;
          line-height: 1.6;
        }
        .apt-btn {
          display: inline-block;
          padding: 11px 26px;
          background: var(--navy);
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          border-radius: 4px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s;
        }
        .apt-btn:hover { background: var(--navy-light); transform: translateY(-2px); }

        /* FEATURES GALLERY */
        .gallery {
          padding: 0 48px 72px;
        }
        .gallery-title {
          font-family: 'DM Serif Display', serif;
          font-size: 26px;
          font-weight: 400;
          color: var(--text);
          margin-bottom: 24px;
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          border-radius: 2px;
          overflow: hidden;
        }
        .gallery-cell {
          aspect-ratio: 16/10;
          background: linear-gradient(135deg, #d4dae0 0%, #bdc6cf 100%);
          position: relative;
          overflow: hidden;
          transition: opacity 0.3s;
        }
        .gallery-cell:hover { opacity: 0.92; }

        /* FEATURE HIGHLIGHTS */
        .highlights {
          padding: 72px 48px;
          background: var(--off-white);
        }
        .highlights-title {
          font-family: 'DM Serif Display', serif;
          font-size: 26px;
          font-weight: 400;
          color: var(--text);
          margin-bottom: 40px;
          text-align: center;
        }
        .highlights-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .highlight-card {
          background: white;
          padding: 28px 24px;
          border: 1px solid var(--light-gray);
          border-radius: 6px;
          transition: box-shadow 0.25s, transform 0.25s;
        }
        .highlight-card:hover {
          box-shadow: 0 8px 24px rgba(30,42,58,0.09);
          transform: translateY(-3px);
        }
        .highlight-icon {
          width: 42px; height: 42px;
          background: #eef1f5;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 19px;
          margin-bottom: 14px;
        }
        .highlight-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 8px;
        }
        .highlight-desc {
          font-size: 13px;
          font-weight: 300;
          color: var(--gray);
          line-height: 1.65;
        }

        /* CONTACT */
        .contact {
          background: var(--navy);
          padding: 80px 48px;
          text-align: center;
        }
        .contact-title {
          font-family: 'DM Serif Display', serif;
          font-size: 34px;
          font-weight: 400;
          color: white;
          margin-bottom: 12px;
        }
        .contact-sub {
          font-size: 15px;
          font-weight: 300;
          color: rgba(255,255,255,0.6);
          margin-bottom: 44px;
        }
        .contact-form {
          max-width: 540px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .contact-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .contact-input, .contact-select {
          width: 100%;
          padding: 13px 16px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 4px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 300;
          outline: none;
          transition: border-color 0.2s;
          appearance: none;
        }
        .contact-input::placeholder { color: rgba(255,255,255,0.35); }
        .contact-input:focus, .contact-select:focus { border-color: rgba(255,255,255,0.45); }
        .contact-select option { background: var(--navy); color: white; }
        .contact-textarea {
          width: 100%;
          padding: 13px 16px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 4px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 300;
          outline: none;
          resize: none;
          height: 108px;
          transition: border-color 0.2s;
        }
        .contact-textarea::placeholder { color: rgba(255,255,255,0.35); }
        .contact-textarea:focus { border-color: rgba(255,255,255,0.45); }
        .contact-submit {
          padding: 14px 44px;
          background: white;
          color: var(--navy);
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
          align-self: center;
          margin-top: 4px;
        }
        .contact-submit:hover { background: #f0f3f7; transform: translateY(-2px); }

        /* FOOTER */
        footer {
          padding: 24px 48px;
          background: #141e29;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-logo {
          font-family: 'DM Serif Display', serif;
          font-size: 15px;
          color: rgba(255,255,255,0.55);
        }
        .footer-copy {
          font-size: 12px;
          font-weight: 300;
          color: rgba(255,255,255,0.3);
        }
        .footer-links { display: flex; gap: 22px; }
        .footer-links a {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-links a:hover { color: rgba(255,255,255,0.75); }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          nav { padding: 0 24px; height: 82px; }
          .nav-links { display: none; }
          .logo-icon { width: 74px; height: 54px; }
          .logo-text { font-size: 22px; }
          .nav-actions { margin-left: auto; gap: 10px; }
          .nav-language { min-width: 100px; }
          .nav-contact-btn { padding: 8px 16px; }
          .hero { margin-top: 82px; height: auto; min-height: 520px; }
          .hero-content { padding: 60px 32px 52px; }
          .hero-sub { max-width: 520px; }
          .apartments { padding: 56px 32px; gap: 34px; }
          .gallery { padding: 0 32px 56px; }
          .highlights { padding: 56px 32px; }
          .highlights-grid { grid-template-columns: 1fr 1fr; }
          .contact { padding: 64px 32px; }
        }

        @media (max-width: 768px) {
          nav { padding: 0 14px; height: 74px; }
          .nav-links { display: none; }
          .logo-icon { width: 58px; height: 44px; }
          .logo-img { transform: translateX(-1px); }
          .logo-text {
            font-size: 18px;
            max-width: 132px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .nav-actions { gap: 8px; }
          .nav-language {
            min-width: 82px;
            height: 32px;
            padding: 0 6px;
            font-size: 11px;
          }
          .nav-contact-btn { padding: 6px 10px; font-size: 12px; }
          .hero { margin-top: 74px; min-height: 420px; }
          .hero-content {
            padding: 34px 18px 40px;
            min-height: calc(100vh - 74px);
          }
          .hero-title {
            font-size: clamp(34px, 10vw, 46px);
            line-height: 1.02;
            margin-bottom: 14px;
          }
          .hero-sub {
            font-size: 15px;
            max-width: none;
            margin-bottom: 24px;
          }
          .hero-btn {
            width: 100%;
            max-width: 280px;
            text-align: center;
            padding: 13px 18px;
          }
          .apartments {
            grid-template-columns: 1fr;
            padding: 40px 18px;
            gap: 30px;
          }
          .apt-btn { width: 100%; text-align: center; padding: 12px 18px; }
          .gallery { padding: 0 18px 40px; }
          .gallery-title { font-size: 22px; margin-bottom: 16px; }
          .highlights { padding: 40px 18px; }
          .highlights-title { font-size: 22px; margin-bottom: 24px; text-align: left; }
          .highlights-grid { grid-template-columns: 1fr; gap: 14px; }
          .highlight-card { padding: 20px 18px; }
          .contact { padding: 46px 18px; }
          .contact-title { font-size: 28px; }
          .contact-sub { margin-bottom: 26px; }
          .contact-row { grid-template-columns: 1fr; }
          .contact-submit { width: 100%; align-self: stretch; }
          footer {
            flex-direction: column;
            gap: 10px;
            text-align: center;
            padding: 18px;
          }
          .footer-links { justify-content: center; flex-wrap: wrap; gap: 14px; }
        }

        @media (max-width: 480px) {
          nav { padding: 0 10px; height: 68px; }
          .logo-icon { width: 52px; height: 40px; }
          .logo-text { display: none; }
          .nav-language { min-width: 74px; font-size: 10.5px; }
          .nav-contact-btn { padding: 6px 8px; font-size: 11.5px; }
          .hero { margin-top: 68px; min-height: 430px; }
          .hero-content {
            padding: 26px 14px 30px;
            min-height: calc(100vh - 68px);
          }
          .hero-title { font-size: clamp(30px, 12vw, 40px); }
          .highlights-grid { grid-template-columns: 1fr; }
          .gallery-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* NAV */}
      <nav className={scrolled ? "scrolled" : ""}>
        <a href="#" className="nav-logo">
          <span className="logo-icon">
            <Image src={BLACK_LOGO_PATH} alt={BLACK_LOGO_ALT} width={84} height={62} className="logo-img" priority />
          </span>
          <span className="logo-text">Orfane Real Estate</span>
        </a>
        <ul className="nav-links">
          <li><a href="#">{t.navHome}</a></li>
          <li><a href="#highlights">{t.navFeatures}</a></li>
          <li><a href="#gallery">{t.navGallery}</a></li>
          <li><a href="#2bed">{t.nav2Bedroom}</a></li>
          <li><a href="#3bed">{t.nav3Bedroom}</a></li>
        </ul>
        <div className="nav-actions">
          <select
            className="nav-language"
            value={googleLanguage}
            onChange={(event) => handleGoogleLanguageChange(event.target.value)}
            aria-label="Google Translate"
          >
            <option value="en">{t.languageEnglish}</option>
            <option value="so">{t.languageSomali}</option>
            <option value="ar">Arabic</option>
          </select>
          <a href="#contact" className="nav-contact-btn">{t.navContact}</a>
        </div>
      </nav>
      <div id="google_translate_element" className="google-translate-hidden" aria-hidden="true" />

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <Image src={LANDING_IMAGE_PATHS.hero} alt="Orfane premium apartment interior" fill priority className="hero-image" />
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">{t.heroTitle}</h1>
          <p className="hero-sub">
            {t.heroSubtitle}
          </p>
          <a href="#contact" className="hero-btn">{t.heroCta}</a>
        </div>
      </section>

      {/* APARTMENT TYPES */}
      <section className="apartments">
        {/* 2-BED */}
        <div id="2bed">
          <p className="apt-type-label">{t.twoBedLabel}</p>
          <p className="apt-type-desc">{t.twoBedShort}</p>
          <div className="apt-img-single">
            <Image
              src={LANDING_IMAGE_PATHS.twoBedMain}
              alt="2 bedroom apartment interior"
              fill
              sizes="(max-width: 768px) 100vw, 48vw"
              className="section-image"
            />
          </div>
          <p className="apt-caption">
            {t.twoBedCaption}
          </p>
          <a href="#contact" className="apt-btn">{t.twoBedCta}</a>
        </div>

        {/* 3-BED */}
        <div id="3bed">
          <p className="apt-type-label">{t.threeBedLabel}</p>
          <p className="apt-type-desc">{t.threeBedShort}</p>
          <div className="apt-img-double">
            <div className="apt-img-cell">
              <Image
                src={LANDING_IMAGE_PATHS.threeBedMain}
                alt="3 bedroom apartment main view"
                fill
                sizes="(max-width: 768px) 100vw, 24vw"
                className="section-image"
              />
            </div>
            <div className="apt-img-cell">
              <Image
                src={LANDING_IMAGE_PATHS.threeBedLivingRoom}
                alt="3 bedroom apartment living room"
                fill
                sizes="(max-width: 768px) 100vw, 24vw"
                className="section-image"
              />
            </div>
            <div className="apt-img-cell">
              <Image
                src={LANDING_IMAGE_PATHS.threeBedKitchen}
                alt="3 bedroom apartment kitchen"
                fill
                sizes="(max-width: 768px) 100vw, 24vw"
                className="section-image"
              />
            </div>
          </div>
          <p className="apt-caption">
            {t.threeBedCaption}
          </p>
          <a href="#contact" className="apt-btn">{t.threeBedCta}</a>
        </div>
      </section>

      {/* GALLERY */}
      <section className="gallery" id="gallery">
        <h2 className="gallery-title">{t.galleryTitle}</h2>
        <div className="gallery-grid">
          {LANDING_GALLERY_IMAGES.map((img, i) => (
            <div className="gallery-cell" key={i}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 768px) 100vw, 48vw"
                className="section-image"
              />
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="highlights" id="highlights">
        <h2 className="highlights-title">{t.highlightsTitle}</h2>
        <div className="highlights-grid">
          {t.highlights.map((f, i) => (
            <div className="highlight-card" key={i}>
              <div className="highlight-icon">{f.icon}</div>
              <div className="highlight-title">{f.title}</div>
              <div className="highlight-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact" id="contact">
        <h2 className="contact-title">{t.contactTitle}</h2>
        <p className="contact-sub">{t.contactSubtitle}</p>
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <div className="contact-row">
            <input className="contact-input" type="text" placeholder={t.firstName} />
            <input className="contact-input" type="text" placeholder={t.lastName} />
          </div>
          <input className="contact-input" type="email" placeholder={t.email} />
          <input className="contact-input" type="tel" placeholder={t.phone} />
          <select className="contact-select" defaultValue="">
            <option value="" disabled>{t.interestedIn}</option>
            <option>{t.optionTwoBed}</option>
            <option>{t.optionThreeBed}</option>
            <option>{t.optionGeneral}</option>
          </select>
          <textarea className="contact-textarea" placeholder={t.message} />
          <button type="submit" className="contact-submit">{t.sendMessage}</button>
        </form>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">Orfane Real Estate</div>
        <p className="footer-copy">© {currentYear} {t.footerRights}</p>
        <div className="footer-links">
          <a href="#">{t.privacy}</a>
          <a href="#">{t.terms}</a>
          <a href="#contact">{t.navContact}</a>
        </div>
      </footer>
    </>
  );
}
