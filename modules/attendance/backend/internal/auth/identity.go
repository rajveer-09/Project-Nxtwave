/*

Author : Rajveer Sharma
Date : 27 Nov 2026
@ Nxtwave

*/

package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// NxtOne (platform/web) proxies /api/attendance/* here and signs a 60-second HS256 identity token
// for every request (platform/web/common/services/identity-token.ts), sent as
// `Authorization: Bearer <token>`. It is the only sign-in this service accepts, the same one the
// contest and interactions services use.
const (
	Issuer   = "student-hub-web"
	Audience = "attendance-api"
	// Leeway is the clock difference allowed between NxtOne and this service.
	Leeway = 5 * time.Second
	// MinSecretLen is the shortest IDENTITY_JWT_SECRET accepted.
	MinSecretLen = 32
)

// ErrInvalidToken: the token is malformed, forged, expired or meant for another service.
var ErrInvalidToken = errors.New("invalid identity token")

// Identity is who NxtOne says is calling.
type Identity struct {
	Sub   string // NxtOne's staff id
	Email string // lower-case
	Name  string // the email when NxtOne has no name
	Role  string // owner | admin | senior_instructor | instructor | success_coach | ...
}

// BearerToken is the token of an `Authorization: Bearer ...` header, or "" without one.
func BearerToken(header string) string {
	scheme, token, ok := strings.Cut(strings.TrimSpace(header), " ")
	if !ok || !strings.EqualFold(scheme, "bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

type tokenClaims struct {
	Iss   string          `json:"iss"`
	Aud   json.RawMessage `json:"aud"`
	Exp   *float64        `json:"exp"`
	Nbf   *float64        `json:"nbf"`
	Sub   string          `json:"sub"`
	Email string          `json:"email"`
	Name  string          `json:"name"`
	Role  string          `json:"role"`
}

// VerifyIdentity checks the signature, algorithm, issuer, audience, expiry and claims.
func VerifyIdentity(token string, secret []byte, now time.Time) (Identity, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		return Identity{}, ErrInvalidToken
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(sig, mac.Sum(nil)) {
		return Identity{}, ErrInvalidToken
	}

	var header struct {
		Alg  string          `json:"alg"`
		Crit json.RawMessage `json:"crit"`
	}
	if decodePart(parts[0], &header) != nil || header.Alg != "HS256" || header.Crit != nil {
		return Identity{}, ErrInvalidToken
	}
	var c tokenClaims
	if decodePart(parts[1], &c) != nil || c.Iss != Issuer || !hasAudience(c.Aud) {
		return Identity{}, ErrInvalidToken
	}
	at := float64(now.Unix())
	lee := Leeway.Seconds()
	if c.Exp == nil || at > *c.Exp+lee || (c.Nbf != nil && at+lee < *c.Nbf) {
		return Identity{}, ErrInvalidToken
	}

	email := strings.ToLower(strings.TrimSpace(c.Email))
	role := strings.TrimSpace(c.Role)
	if c.Sub == "" || role == "" || !strings.Contains(email, "@") {
		return Identity{}, ErrInvalidToken
	}
	name := strings.TrimSpace(c.Name)
	if name == "" {
		name = email
	}
	return Identity{Sub: c.Sub, Email: email, Name: name, Role: role}, nil
}

func decodePart(part string, v any) error {
	raw, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, v)
}

// hasAudience: aud is "attendance-api", or a list holding it.
func hasAudience(raw json.RawMessage) bool {
	var one string
	if json.Unmarshal(raw, &one) == nil {
		return one == Audience
	}
	var many []string
	if json.Unmarshal(raw, &many) == nil {
		for _, a := range many {
			if a == Audience {
				return true
			}
		}
	}
	return false
}
