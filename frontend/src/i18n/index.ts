import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enOverview from "./locales/en/overview.json";
import enIncome from "./locales/en/income.json";
import enExpenses from "./locales/en/expenses.json";
import enSettings from "./locales/en/settings.json";
import enNotFound from "./locales/en/notFound.json";

import svCommon from "./locales/sv/common.json";
import svAuth from "./locales/sv/auth.json";
import svOverview from "./locales/sv/overview.json";
import svIncome from "./locales/sv/income.json";
import svExpenses from "./locales/sv/expenses.json";
import svSettings from "./locales/sv/settings.json";
import svNotFound from "./locales/sv/notFound.json";

export const SUPPORTED_LANGUAGES = ["en", "sv"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const NAMESPACES = [
  "common",
  "auth",
  "overview",
  "income",
  "expenses",
  "settings",
  "notFound",
] as const;

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    overview: enOverview,
    income: enIncome,
    expenses: enExpenses,
    settings: enSettings,
    notFound: enNotFound,
  },
  sv: {
    common: svCommon,
    auth: svAuth,
    overview: svOverview,
    income: svIncome,
    expenses: svExpenses,
    settings: svSettings,
    notFound: svNotFound,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: NAMESPACES,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "hh_lang",
      caches: ["localStorage"],
    },
    returnNull: false,
  });

export default i18n;
