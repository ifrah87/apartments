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
const TWO_BED_IMAGES = [
  { src: LANDING_IMAGE_PATHS.twoBedMain, alt: "Private office suite interior" },
  { src: LANDING_IMAGE_PATHS.twoBedLivingRoom, alt: "Executive office meeting area" },
  { src: LANDING_IMAGE_PATHS.twoBedKitchen, alt: "Office kitchenette and pantry area" },
  { src: LANDING_IMAGE_PATHS.twoBedBathroom, alt: "Premium office washroom" },
];
const THREE_BED_IMAGES = [
  { src: LANDING_IMAGE_PATHS.threeBedMain, alt: "Collaborative office floor interior" },
  { src: LANDING_IMAGE_PATHS.threeBedLivingRoom, alt: "Open-plan office lounge" },
  { src: LANDING_IMAGE_PATHS.threeBedKitchen, alt: "Shared office pantry and break area" },
  { src: LANDING_IMAGE_PATHS.threeBedBathroom, alt: "Commercial office facilities" },
];
const LANDING_GALLERY_IMAGES = [
  { src: LANDING_IMAGE_PATHS.twoBedLivingRoom, alt: "Meeting-ready office suite" },
  { src: LANDING_IMAGE_PATHS.twoBedBathroom, alt: "Professional office facilities" },
  { src: LANDING_IMAGE_PATHS.threeBedLivingRoom, alt: "Open collaborative office area" },
  { src: LANDING_IMAGE_PATHS.threeBedKitchen, alt: "Modern office support space" },
];

function wrapCarouselIndex(current: number, delta: number, length: number) {
  return (current + delta + length) % length;
}

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
    nav2Bedroom: "Private Suites",
    nav3Bedroom: "Team Floors",
    navContact: "Contact",
    heroTitle: "Professional\nOffice Spaces\nfor Growing Teams",
    heroSubtitle: "Move into premium private suites and full-floor office spaces designed for modern business.",
    heroCta: "Book a Site Tour",
    twoBedLabel: "Private Office Suites",
    twoBedShort: "Fully serviced executive suites for focused teams",
    twoBedCaption:
      "Move-in ready private suites with polished interiors, reception support, and daily operations convenience for professional teams.",
    twoBedCta: "View Private Suites",
    threeBedLabel: "Full-Floor Team Offices",
    threeBedShort: "Spacious office floors built for collaborative companies",
    threeBedCaption:
      "Open-plan layouts with dedicated meeting zones and premium infrastructure, ideal for scaling teams and headquarters operations.",
    threeBedCta: "View Team Floors",
    galleryTitle: "Workspace Gallery",
    highlightsTitle: "Everything Your Team Needs",
    highlights: [
      { icon: "🏢", title: "Premium Business Address", desc: "Present your brand from a central location trusted by clients and partners." },
      { icon: "📶", title: "High-Speed Internet", desc: "Reliable, business-grade connectivity ready for meetings, cloud tools, and teams." },
      { icon: "👥", title: "Meeting & Collaboration Areas", desc: "Dedicated rooms and shared spaces for presentations, planning, and teamwork." },
      { icon: "🔒", title: "Secure Access", desc: "Monitored entry, controlled access, and professional building management." },
    ],
    contactTitle: "Contact Us",
    contactSubtitle: "Talk to our team to schedule a tour, compare plans, and secure the right office space.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    phone: "Phone number",
    interestedIn: "Interested in...",
    optionTwoBed: "Private Office Suite",
    optionThreeBed: "Full-Floor Team Office",
    optionGeneral: "General Office Enquiry",
    message: "Your message...",
    sendMessage: "Send Message",
    footerRights: "Orfane Office Spaces. All rights reserved.",
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
    nav2Bedroom: "Xafiisyo Gaar ah",
    nav3Bedroom: "Dabaqyo Kooxo",
    navContact: "La Xiriir",
    heroTitle: "Goobo Xafiis\nCasri ah\noo Kooxo u Diyaar ah",
    heroSubtitle: "Xafiisyo gaar ah iyo dabaqyo waaweyn oo shirkado casri ah loogu talagalay, hadda diyaar ah.",
    heroCta: "Qabso Dalxiis",
    twoBedLabel: "Xafiisyo Gaar ah",
    twoBedShort: "Xafiisyo nadiif ah oo adeegyo dhameystiran leh",
    twoBedCaption:
      "Xafiisyo gaar ah oo si buuxda loo diyaariyey, ku habboon kooxaha u baahan jawi xirfadeed iyo wax-qabad sare.",
    twoBedCta: "Daawo Xafiisyada Gaar ah",
    threeBedLabel: "Dabaqyo Xafiis Kooxo",
    threeBedShort: "Meelo waaweyn oo loogu talagalay kooxo iyo waaxyo",
    threeBedCaption:
      "Dabaqyo xafiis oo waaweyn oo leh meel wada-shaqeyn, qolal kulan, iyo kaabayaal tayo sare leh.",
    threeBedCta: "Daawo Dabaqyada Kooxo",
    galleryTitle: "Sawirrada Xafiisyada",
    highlightsTitle: "Waxyaabaha La Helo",
    highlights: [
      { icon: "🏢", title: "Cinwaan Ganacsi Heer Sare ah", desc: "Goob ganacsi oo sumcad leh oo ku habboon shirkadaha casriga ah." },
      { icon: "📶", title: "Internet Xawaare Sare leh", desc: "Xiriir deggan oo ku habboon kulamada onlaynka iyo shaqada maalinlaha ah." },
      { icon: "👥", title: "Qolal Kulan iyo Wada-shaqeyn", desc: "Meelo loogu talagalay kulamo, qorsheyn, iyo wada-shaqeyn kooxeed." },
      { icon: "🔒", title: "Ammaan iyo Kontorool Gelitaan", desc: "Gelitaan la maamulo, kormeer joogto ah, iyo maamul xirfadeed." },
    ],
    contactTitle: "Nala Soo Xiriir",
    contactSubtitle: "Nala soo xiriir si aad u qabsato dalxiis oo aad u hesho qorshaha xafiis ee ku habboon kooxdaada.",
    firstName: "Magaca hore",
    lastName: "Magaca dambe",
    email: "Cinwaanka iimaylka",
    phone: "Lambarka telefoonka",
    interestedIn: "Waxaan daneynayaa...",
    optionTwoBed: "Xafiis Gaar ah",
    optionThreeBed: "Dabaq Xafiis Kooxo",
    optionGeneral: "Weydiin Xafiis Guud",
    message: "Fariintaada...",
    sendMessage: "Dir Farriin",
    footerRights: "Orfane Office Spaces. Dhammaan xuquuqdu way dhowran tahay.",
    privacy: "Asturnaanta",
    terms: "Shuruudaha",
  },
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [googleLanguage, setGoogleLanguage] = useState<GoogleLanguage>("en");
  const [googleLanguageReady, setGoogleLanguageReady] = useState(false);
  const [twoBedImageIndex, setTwoBedImageIndex] = useState(0);
  const [threeBedImageIndex, setThreeBedImageIndex] = useState(0);
  const [galleryImageIndex, setGalleryImageIndex] = useState(0);
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

  const prevTwoBedImage = () => setTwoBedImageIndex((prev) => wrapCarouselIndex(prev, -1, TWO_BED_IMAGES.length));
  const nextTwoBedImage = () => setTwoBedImageIndex((prev) => wrapCarouselIndex(prev, 1, TWO_BED_IMAGES.length));
  const prevThreeBedImage = () => setThreeBedImageIndex((prev) => wrapCarouselIndex(prev, -1, THREE_BED_IMAGES.length));
  const nextThreeBedImage = () => setThreeBedImageIndex((prev) => wrapCarouselIndex(prev, 1, THREE_BED_IMAGES.length));
  const prevGalleryImage = () => setGalleryImageIndex((prev) => wrapCarouselIndex(prev, -1, LANDING_GALLERY_IMAGES.length));
  const nextGalleryImage = () => setGalleryImageIndex((prev) => wrapCarouselIndex(prev, 1, LANDING_GALLERY_IMAGES.length));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --navy: #0f172a;
          --navy-light: #1e293b;
          --white: #ffffff;
          --off-white: #f8fafc;
          --gray: #64748b;
          --light-gray: #e2e8f0;
          --text: #0f172a;
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
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--light-gray);
          padding: 0 36px;
          height: var(--nav-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: box-shadow 0.3s;
        }
        nav.scrolled { box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }

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
          font-weight: 500;
          color: #334155;
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
          background: var(--navy);
          border: 1px solid var(--navy);
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 4px;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .nav-contact-btn:hover { background: var(--navy-light); color: white; }

        /* HERO */
        .hero {
          margin-top: var(--nav-height);
          position: relative;
          min-height: 620px;
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
            rgba(2,6,23,0.7) 0%,
            rgba(2,6,23,0.5) 35%,
            rgba(2,6,23,0.2) 70%,
            rgba(2,6,23,0.05) 100%
          );
        }
        .hero-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 8% 0 10%;
          max-width: 720px;
        }
        .hero-title {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(38px, 5.5vw, 64px);
          font-weight: 400;
          line-height: 1.08;
          color: white;
          margin-bottom: 20px;
          white-space: pre-line;
        }
        .hero-sub {
          font-size: 16px;
          font-weight: 300;
          line-height: 1.65;
          color: rgba(255,255,255,0.86);
          margin-bottom: 32px;
          max-width: 560px;
        }
        .hero-btn {
          display: inline-block;
          padding: 14px 32px;
          background: white;
          color: var(--navy);
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.25s, transform 0.2s;
          align-self: flex-start;
        }
        .hero-btn:hover { background: #f1f5f9; transform: translateY(-2px); }

        /* APARTMENTS */
        .apartments {
          padding: 88px 48px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 56px;
          max-width: 1240px;
          margin: 0 auto;
        }
        .apartments > div {
          border: 1px solid var(--light-gray);
          border-radius: 16px;
          padding: 24px;
          background: white;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
        }
        .apt-type-label {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #0b3b8f;
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
        .image-carousel {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #d4dae0 0%, #c2cad2 100%);
        }
        .image-carousel.gallery-carousel {
          aspect-ratio: 16/10;
          margin-bottom: 0;
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
        .carousel-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.62);
          color: #ffffff;
          display: grid;
          place-items: center;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
          z-index: 3;
        }
        .carousel-btn:hover {
          background: rgba(15, 23, 42, 0.82);
          transform: translateY(-50%) scale(1.03);
        }
        .carousel-btn.prev { left: 10px; }
        .carousel-btn.next { right: 10px; }
        .carousel-dots {
          position: absolute;
          left: 50%;
          bottom: 10px;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
          z-index: 3;
        }
        .carousel-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          border: none;
          background: rgba(255,255,255,0.55);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .carousel-dot.active {
          background: #ffffff;
          transform: scale(1.12);
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
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s;
        }
        .apt-btn:hover { background: var(--navy-light); transform: translateY(-2px); }

        /* FEATURES GALLERY */
        .gallery {
          padding: 0 48px 88px;
          max-width: 1240px;
          margin: 0 auto;
        }
        .gallery-title {
          font-family: 'DM Serif Display', serif;
          font-size: 26px;
          font-weight: 400;
          color: var(--text);
          margin-bottom: 20px;
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
          padding: 88px 48px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
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
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          max-width: 1240px;
          margin: 0 auto;
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
          background: #0b1220;
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
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
          align-self: center;
          margin-top: 4px;
        }
        .contact-submit:hover { background: #f0f3f7; transform: translateY(-2px); }

        /* FOOTER */
        footer {
          padding: 24px 48px;
          background: #090f1b;
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
          .hero { margin-top: 82px; height: auto; min-height: 560px; }
          .hero-content { padding: 60px 32px 52px; }
          .hero-sub { max-width: 520px; }
          .apartments { padding: 56px 32px; gap: 34px; }
          .apartments > div { padding: 20px; }
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
          .hero { margin-top: 74px; min-height: 500px; }
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
          .apartments > div { padding: 18px; border-radius: 14px; }
          .apt-btn { width: 100%; text-align: center; padding: 12px 18px; }
          .carousel-btn {
            width: 30px;
            height: 30px;
            font-size: 18px;
          }
          .carousel-btn.prev { left: 8px; }
          .carousel-btn.next { right: 8px; }
          .carousel-dots { bottom: 8px; }
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
          .hero { margin-top: 68px; min-height: 470px; }
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
          <span className="logo-text">Orfane Office Spaces</span>
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
          <Image src={LANDING_IMAGE_PATHS.hero} alt="Orfane professional office interior" fill priority className="hero-image" />
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
          <div className="image-carousel">
            <Image
              src={TWO_BED_IMAGES[twoBedImageIndex].src}
              alt={TWO_BED_IMAGES[twoBedImageIndex].alt}
              fill
              sizes="(max-width: 768px) 100vw, 48vw"
              className="section-image"
            />
            <button type="button" className="carousel-btn prev" onClick={prevTwoBedImage} aria-label="Previous 2 bedroom photo">‹</button>
            <button type="button" className="carousel-btn next" onClick={nextTwoBedImage} aria-label="Next 2 bedroom photo">›</button>
            <div className="carousel-dots">
              {TWO_BED_IMAGES.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  className={`carousel-dot ${index === twoBedImageIndex ? "active" : ""}`}
                  aria-label={`Go to 2 bedroom photo ${index + 1}`}
                  onClick={() => setTwoBedImageIndex(index)}
                />
              ))}
            </div>
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
          <div className="image-carousel">
            <Image
              src={THREE_BED_IMAGES[threeBedImageIndex].src}
              alt={THREE_BED_IMAGES[threeBedImageIndex].alt}
              fill
              sizes="(max-width: 768px) 100vw, 48vw"
              className="section-image"
            />
            <button type="button" className="carousel-btn prev" onClick={prevThreeBedImage} aria-label="Previous 3 bedroom photo">‹</button>
            <button type="button" className="carousel-btn next" onClick={nextThreeBedImage} aria-label="Next 3 bedroom photo">›</button>
            <div className="carousel-dots">
              {THREE_BED_IMAGES.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  className={`carousel-dot ${index === threeBedImageIndex ? "active" : ""}`}
                  aria-label={`Go to 3 bedroom photo ${index + 1}`}
                  onClick={() => setThreeBedImageIndex(index)}
                />
              ))}
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
        <div className="image-carousel gallery-carousel">
          <Image
            src={LANDING_GALLERY_IMAGES[galleryImageIndex].src}
            alt={LANDING_GALLERY_IMAGES[galleryImageIndex].alt}
            fill
            sizes="(max-width: 768px) 100vw, 92vw"
            className="section-image"
          />
          <button type="button" className="carousel-btn prev" onClick={prevGalleryImage} aria-label="Previous gallery photo">‹</button>
          <button type="button" className="carousel-btn next" onClick={nextGalleryImage} aria-label="Next gallery photo">›</button>
          <div className="carousel-dots">
            {LANDING_GALLERY_IMAGES.map((image, index) => (
              <button
                key={image.src}
                type="button"
                className={`carousel-dot ${index === galleryImageIndex ? "active" : ""}`}
                aria-label={`Go to gallery photo ${index + 1}`}
                onClick={() => setGalleryImageIndex(index)}
              />
            ))}
          </div>
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
        <div className="footer-logo">Orfane Office Spaces</div>
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
