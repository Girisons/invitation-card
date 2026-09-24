-- =============================================
-- Arpit 40th Birthday Invite - Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. GUESTS TABLE
-- Har invited guest ki details
CREATE TABLE guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id TEXT UNIQUE NOT NULL,          -- WhatsApp link ka unique ID (e.g. guest_001)
  name TEXT NOT NULL,                    -- Guest ka naam
  salutation TEXT,                       -- "Respected Ramesh Uncle Ji"
  phone TEXT,                            -- Mobile number
  relation TEXT,                         -- uncle, auntie, friend, colleague
  face_image_url TEXT,                   -- Supabase Storage mein face photo ka URL
  script TEXT,                           -- Personalized video script
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RSVP RESPONSES TABLE
-- Guest ne RSVP kiya ya nahi
CREATE TABLE rsvp_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id),
  link_id TEXT NOT NULL,
  response TEXT NOT NULL,               -- 'attending' ya 'not_attending'
  responded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PARTY PHOTOS TABLE
-- Cameraman jo photos upload kare
CREATE TABLE party_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_url TEXT NOT NULL,              -- Supabase Storage mein photo ka URL
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  is_processed BOOLEAN DEFAULT FALSE   -- Face recognition ho gayi ya nahi
);

-- 4. PHOTO MATCHES TABLE
-- Kaun sa guest kis photo mein hai
CREATE TABLE photo_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES party_photos(id),
  guest_id UUID REFERENCES guests(id),
  confidence FLOAT,                     -- Face match confidence score (0 to 1)
  matched_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SAMPLE DATA - Test Guests
-- =============================================
INSERT INTO guests (link_id, name, salutation, phone, relation, script) VALUES
('guest_001', 'Ramesh Uncle', 'Respected Ramesh Uncle Ji 🙏', '+91-98765-00001', 'uncle', 
 'Respected Ramesh Uncle, warm greetings! This is Vipul speaking to you live from our celebration venue! My elder brother Arpit is turning 40 on the 23rd of October, and this milestone celebration is incomplete without your blessings and presence. Please save the date!'),
('guest_002', 'Sunita Auntie', 'Respected Sunita Auntie Ji ✨', '+91-98765-00002', 'auntie',
 'Respected Sunita Auntie, warmest greetings! This is Vipul broadcasting live from the party stage! We are hosting a grand 40th birthday celebration for my beloved brother Arpit on October 23rd. Please save the date!'),
('guest_003', 'Vikram Ji', 'Hello Vikram! 🎉', '+91-98765-00003', 'friend',
 'Hello Vikram! Vipul here, live from the party zone! My elder brother Arpit is hitting his big 40th milestone on October 23rd! Lock in the date right now!'),
('guest_004', 'Priya Sharma', 'Dear Priya Ji 💫', '+91-98765-00004', 'colleague',
 'Dear Priya Ji, warm greetings! Vipul here from the event venue! We are organizing a grand blockbuster celebration for Arpit 40th Birthday on October 23rd. Save the date!');

-- =============================================
-- ROW LEVEL SECURITY (Public Read for guests)
-- =============================================
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_matches ENABLE ROW LEVEL SECURITY;

-- Anyone can read guest info using their link_id (for personalization)
CREATE POLICY "Public can read guest by link_id"
  ON guests FOR SELECT
  USING (true);

-- Anyone can insert RSVP response
CREATE POLICY "Anyone can RSVP"
  ON rsvp_responses FOR INSERT
  WITH CHECK (true);

-- Anyone can read party photos
CREATE POLICY "Public can read party photos"
  ON party_photos FOR SELECT
  USING (true);

-- Anyone can read photo matches
CREATE POLICY "Public can read photo matches"
  ON photo_matches FOR SELECT
  USING (true);
