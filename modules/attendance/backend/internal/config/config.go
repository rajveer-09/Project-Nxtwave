// Package config loads API settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/joho/godotenv"

	"attendance-dashboard/api/internal/auth"
)

const (
	// localDatabaseURL matches the Postgres service in docker-compose.yml.
	localDatabaseURL = "postgres://attendance:attendance@localhost:5433/attendance?sslmode=disable"
	// devIdentitySecret matches ATTENDANCE_JWT_SECRET in infra/docker-compose.yml. Never used in production.
	devIdentitySecret = "local-dev-attendance-identity-secret-0001"
)

type Config struct {
	Env         string // "development" or "production"
	DatabaseURL string
	Port        string
	// IdentitySecret verifies NxtOne's identity tokens: the same value as ATTENDANCE_JWT_SECRET in
	// NxtOne (platform/web). People sign in to NxtOne only.
	IdentitySecret string
}

func (c Config) IsProduction() bool { return c.Env == "production" }

// Load reads the environment. A .env file in the working directory is read
// only when APP_ENV is not "production"; real env vars always win over it.
func Load() (Config, error) {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "" {
		env = "development"
	}
	if env != "development" && env != "production" {
		return Config{}, fmt.Errorf("APP_ENV must be development or production, got %q", env)
	}
	if env == "development" {
		if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
			return Config{}, fmt.Errorf("read .env: %w", err)
		}
	}
	return fromEnv(env, os.Getenv)
}

func fromEnv(env string, getenv func(string) string) (Config, error) {
	get := func(key string) string { return strings.TrimSpace(getenv(key)) }

	cfg := Config{
		Env:            env,
		DatabaseURL:    get("DATABASE_URL"),
		Port:           get("PORT"),
		IdentitySecret: get("IDENTITY_JWT_SECRET"),
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	if cfg.IsProduction() {
		var missing []string
		for key, val := range map[string]string{
			"DATABASE_URL":        cfg.DatabaseURL,
			"IDENTITY_JWT_SECRET": cfg.IdentitySecret,
		} {
			if val == "" {
				missing = append(missing, key)
			}
		}
		if len(missing) > 0 {
			slices.Sort(missing)
			return Config{}, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", "))
		}
	} else {
		if cfg.DatabaseURL == "" {
			cfg.DatabaseURL = localDatabaseURL
		}
		if cfg.IdentitySecret == "" {
			cfg.IdentitySecret = devIdentitySecret
		}
	}

	if len(cfg.IdentitySecret) < auth.MinSecretLen {
		return Config{}, fmt.Errorf("IDENTITY_JWT_SECRET must be at least %d characters", auth.MinSecretLen)
	}
	return cfg, nil
}
