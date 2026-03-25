-- ============================================================
-- Chess Arena — Supabase Database FIX (run this, not the old one)
-- Supabase → SQL Editor → New query → paste all → Run
-- Fixes RLS policies that block service_role writes.
-- ============================================================

-- Drop old policies first
DROP POLICY IF EXISTS "Public read players"        ON players;
DROP POLICY IF EXISTS "Public read ai_models"      ON ai_models;
DROP POLICY IF EXISTS "Public read game_history"   ON game_history;
DROP POLICY IF EXISTS "Service write players"      ON players;
DROP POLICY IF EXISTS "Service write ai_models"    ON ai_models;
DROP POLICY IF EXISTS "Service write game_history" ON game_history;

-- Tables
CREATE TABLE IF NOT EXISTS players (
    id                BIGSERIAL    PRIMARY KEY,
    username          VARCHAR(20)  UNIQUE NOT NULL,
    total_score       BIGINT       DEFAULT 0,
    total_wins        INT          DEFAULT 0,
    total_losses      INT          DEFAULT 0,
    total_draws       INT          DEFAULT 0,
    total_games       INT          DEFAULT 0,
    best_streak       INT          DEFAULT 0,
    player_level      INT          DEFAULT 1,
    defeated_apex     BOOLEAN      DEFAULT FALSE,
    favorite_opponent VARCHAR(100),
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    last_played       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_models (
    id                   BIGSERIAL    PRIMARY KEY,
    model_id             VARCHAR(120) UNIQUE NOT NULL,
    model_name           VARCHAR(100) NOT NULL,
    provider             VARCHAR(80),
    tier                 VARCHAR(40),
    wins_against_humans  INT          DEFAULT 0,
    losses_to_humans     INT          DEFAULT 0,
    draws                INT          DEFAULT 0,
    total_games          INT          DEFAULT 0,
    last_played          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_history (
    id             BIGSERIAL    PRIMARY KEY,
    username       VARCHAR(20)  NOT NULL,
    model_id       VARCHAR(120) NOT NULL,
    model_name     VARCHAR(100) NOT NULL,
    result         VARCHAR(10)  NOT NULL CHECK (result IN ('win', 'lose', 'draw')),
    score_earned   INT          DEFAULT 0,
    move_count     INT          DEFAULT 0,
    duration_secs  INT          DEFAULT 0,
    played_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_score    ON players (total_score DESC);
CREATE INDEX IF NOT EXISTS idx_players_username ON players (username);
CREATE INDEX IF NOT EXISTS idx_ai_wins          ON ai_models (wins_against_humans DESC);
CREATE INDEX IF NOT EXISTS idx_history_user     ON game_history (username);
CREATE INDEX IF NOT EXISTS idx_history_played   ON game_history (played_at DESC);

-- Enable RLS
ALTER TABLE players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models    ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- Public READ (anon key can read for leaderboard display)
CREATE POLICY "Public read players"
    ON players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read ai_models"
    ON ai_models FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read game_history"
    ON game_history FOR SELECT TO anon, authenticated USING (true);

-- Service role WRITE (explicit — service_role bypasses RLS but being explicit is safer)
CREATE POLICY "Service write players"
    ON players FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write ai_models"
    ON ai_models FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write game_history"
    ON game_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-cleanup trigger
CREATE OR REPLACE FUNCTION trim_game_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM game_history WHERE id IN (
        SELECT id FROM game_history ORDER BY played_at DESC OFFSET 10000
    );
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_trim_history ON game_history;
CREATE TRIGGER trg_trim_history
    AFTER INSERT ON game_history FOR EACH STATEMENT
    EXECUTE FUNCTION trim_game_history();

-- Seed AI models
INSERT INTO ai_models (model_id, model_name, provider, tier) VALUES
    ('google/gemma-3-4b-it:free',                    'Gemma 3 4B',          'Google',        'Recruit'),
    ('liquid/lfm-2.5-1.2b-instruct:free',            'LFM 1.2B',            'LiquidAI',      'Recruit'),
    ('meta-llama/llama-3.2-3b-instruct:free',        'Llama 3.2 3B',        'Meta',          'Apprentice'),
    ('google/gemma-3-12b-it:free',                   'Gemma 3 12B',         'Google',        'Apprentice'),
    ('nvidia/nemotron-nano-9b-v2:free',              'Nemotron Nano 9B',    'NVIDIA',        'Knight'),
    ('mistralai/mistral-small-3.1-24b-instruct:free','Mistral Small 3.1',   'Mistral AI',    'Knight'),
    ('meta-llama/llama-3.3-70b-instruct:free',       'Llama 3.3 70B',       'Meta',          'Elite'),
    ('google/gemma-3-27b-it:free',                   'Gemma 3 27B',         'Google',        'Elite'),
    ('nvidia/nemotron-3-super-120b-a12b:free',       'Nemotron Super 120B', 'NVIDIA',        'Master'),
    ('qwen/qwen3-next-80b-a3b-instruct:free',        'Qwen3 Next 80B',      'Alibaba Cloud', 'Master'),
    ('deepseek/deepseek-chat-v3-0324:free',          'DeepSeek V3',         'DeepSeek',      'Apex')
ON CONFLICT (model_id) DO NOTHING;

-- Views
CREATE OR REPLACE VIEW leaderboard AS
SELECT username, total_score, total_wins, total_losses, total_games, best_streak,
    player_level, defeated_apex, favorite_opponent,
    CASE WHEN total_games > 0 THEN ROUND((total_wins::NUMERIC/total_games)*100,1) ELSE 0 END AS win_rate_pct,
    last_played
FROM players ORDER BY total_score DESC LIMIT 20;

CREATE OR REPLACE VIEW ai_rankings AS
SELECT model_id, model_name, provider, tier, wins_against_humans, losses_to_humans, total_games,
    CASE WHEN total_games > 0 THEN ROUND((wins_against_humans::NUMERIC/total_games)*100,1) ELSE 0 END AS win_rate_pct,
    last_played
FROM ai_models ORDER BY wins_against_humans DESC;

-- TEST: run this to confirm writes work
-- INSERT INTO players (username, total_score, total_wins, total_games)
-- VALUES ('__test__', 999, 1, 1) ON CONFLICT (username) DO UPDATE SET total_score = 999;
-- SELECT * FROM players WHERE username = '__test__';
-- DELETE FROM players WHERE username = '__test__';
