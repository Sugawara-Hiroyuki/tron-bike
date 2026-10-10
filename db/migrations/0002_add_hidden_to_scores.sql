-- 不適切な名前の登録を、行を消さずにランキングから外せるようにする
alter table scores add column if not exists hidden boolean not null default false;
