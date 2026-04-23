# RBSHIFT — PWA plánovač směn

Hotová verze 1.0 pro:
- řidiče
- dispečink
- admina

## Co aplikace umí

### Řidič
- přihlášení
- přehled dnešní směny
- moje směny
- potvrzení / odmítnutí směny
- zadání dostupnosti a nepřítomnosti

### Dispečer / admin
- dashboard dnešních směn
- problémové směny
- kalendář den / týden / měsíc
- vytváření a editace směn
- kontrola kolizí řidiče a auta
- servisní blokace vozidel
- evidence nepřítomností
- správa řidičů a vozidel
- historie změn

## Režimy provozu

### 1. Demo režim
Pokud není vyplněný `.env`, aplikace běží ihned jako demo.
To je vhodné pro:
- rychlé otestování UI
- ukázku řidičské části
- první nasazení bez backendu

### 2. Ostrý provoz přes Supabase
Doplň `.env` podle `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Potom v Supabase spusť SQL ze souboru:

- `supabase/schema.sql`

## Spuštění lokálně

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

### Doporučená varianta
- GitHub = zdrojový kód
- Vercel = hosting aplikace
- Supabase = databáze + auth + RLS

## PWA
Aplikace obsahuje:
- `manifest.webmanifest`
- `service worker`
- ikony aplikace

Na iPhone / Android jde přidat na plochu jako appka.

## Poznámka k Supabase Auth
Tato verze předpokládá tabulku `profiles`, která je navázaná na `auth.users` přes stejné `id`.
Po vytvoření uživatele v Supabase Auth mu vytvoř odpovídající záznam v tabulce `profiles` a případně i v `drivers`.

## Poznámka k RLS
Ve schématu jsou připravené základní RLS politiky:
- řidič vidí jen své směny a svou dostupnost
- dispečer a admin vidí vše
- dispečer a admin mohou zapisovat

Doporučuju po nasazení ještě doladit přesně podle provozu.
