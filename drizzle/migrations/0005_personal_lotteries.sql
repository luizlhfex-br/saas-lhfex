CREATE TABLE IF NOT EXISTS personal_lotteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_type varchar(50) NOT NULL,
  game_name varchar(255) NOT NULL,
  draw_date date,
  bet_numbers text,
  draw_results text,
  is_checked boolean NOT NULL DEFAULT false,
  has_won boolean NOT NULL DEFAULT false,
  win_amount numeric(12,2),
  status varchar(50) NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS personal_lotteries_user_id_idx ON personal_lotteries (user_id);
CREATE INDEX IF NOT EXISTS personal_lotteries_game_type_idx ON personal_lotteries (game_type);
CREATE INDEX IF NOT EXISTS personal_lotteries_draw_date_idx ON personal_lotteries (draw_date);
CREATE INDEX IF NOT EXISTS personal_lotteries_status_idx ON personal_lotteries (status);
