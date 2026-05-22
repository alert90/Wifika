import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompanySettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  baseUrl: string;
  adminPhone: string;
  logo?: string;
}

interface AppState {
  locale: 'id' | 'en';
  company: CompanySettings;
  setLocale: (locale: 'id' | 'en') => void;
  setCompany: (company: Partial<CompanySettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      locale: 'id',
      company: {
        name: 'Skylink',
        email: 'dickx005@gmail.com',
        phone: '+255 778-884-955',
        address: 'Dar_Es_Salaam, Tanzania',
        baseUrl: '',
        adminPhone: '+255 778-884-955',
      },
      setLocale: (locale) => set({ locale }),
      setCompany: (company) =>
        set((state) => ({
          company: { ...state.company, ...company },
        })),
    }),
    {
      name: 'skylink-settings',
    }
  )
);
