package http

import (
	"context"
	"net/http"
	"strings"

	"attendance-dashboard/api/internal/auth"
	"attendance-dashboard/api/internal/db"
)

// Sign-in is NxtOne's: every request carries its identity token (auth.VerifyIdentity), and the
// role in it decides what the caller may do here, as in NxtOne itself:
//
//	owner                          everything
//	admin                          everything except Owner-only routes (attendance analytics included)
//	success_coach                  the staff routes below, plus attendance analytics
//	senior_instructor, instructor  the staff routes below
//
// Anyone else (a student, an unknown role) is refused.

type adminKey struct{}

// adminFrom is the caller: ID is their attendance.admins row (what updated_by, created_by and the
// rest record), Role is their NxtOne role.
func adminFrom(ctx context.Context) db.Admin {
	a, _ := ctx.Value(adminKey{}).(db.Admin)
	return a
}

// staffReads are the reads NxtOne's Attendance pages make for instructors, senior instructors and
// success coaches: marking a hall, the calendar, terms and internships.
var staffReads = map[string]bool{
	"/api/admin/halls":            true,
	"/api/admin/attendance/sheet": true,
	"/api/admin/calendar":         true,
	"/api/admin/terms":            true,
	"/api/admin/internships":      true,
}

// staffMay: what instructors, senior instructors and success coaches may call. Their one change is
// marking a hall (PUT /api/admin/attendance); success coaches also read attendance analytics.
func staffMay(role, method, path string) bool {
	switch method {
	case http.MethodGet, http.MethodHead:
		return staffReads[path] || (role == "success_coach" && strings.HasPrefix(path, "/api/admin/analytics"))
	case http.MethodPut:
		return path == "/api/admin/attendance"
	}
	return false
}

// requireStaff checks NxtOne's identity token on every request: 401 without a valid one, 403 for a
// role that may not call this route.
func (s *Server) requireStaff(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := auth.BearerToken(r.Header.Get("Authorization"))
		if token == "" {
			writeError(w, http.StatusUnauthorized, "unauthenticated", "Sign in to NxtOne.", nil)
			return
		}
		who, err := auth.VerifyIdentity(token, s.identitySecret, s.now())
		if err != nil {
			s.log.Info("identity token refused")
			writeError(w, http.StatusUnauthorized, "unauthenticated", "Your sign-in isn't valid any more. Reload the page.", nil)
			return
		}
		switch who.Role {
		case "owner", "admin":
		case "senior_instructor", "instructor", "success_coach":
			if !staffMay(who.Role, r.Method, r.URL.Path) {
				writeError(w, http.StatusForbidden, "forbidden", "Your role can't do this in attendance.", nil)
				return
			}
		default:
			writeError(w, http.StatusForbidden, "forbidden", "Your role can't use attendance.", nil)
			return
		}
		id, err := s.adminID(r.Context(), who)
		if err != nil {
			s.internalError(w, "requireStaff: admin row", err)
			return
		}
		admin := db.Admin{ID: id, Email: who.Email, Name: who.Name, Role: who.Role, Active: true}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), adminKey{}, admin)))
	})
}

// adminID is the caller's attendance.admins row, created on their first request. Rows are never
// deleted (nothing here removes them), so an id is remembered for the life of the process.
func (s *Server) adminID(ctx context.Context, who auth.Identity) (int64, error) {
	s.idsMu.Lock()
	id, ok := s.ids[who.Email]
	s.idsMu.Unlock()
	if ok {
		return id, nil
	}
	id, err := s.store.EnsureAdmin(ctx, db.EnsureAdminParams{Email: who.Email, Name: who.Name})
	if err != nil {
		return 0, err
	}
	s.idsMu.Lock()
	s.ids[who.Email] = id
	s.idsMu.Unlock()
	return id, nil
}

// requireOwner must run after requireStaff.
func (s *Server) requireOwner(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if adminFrom(r.Context()).Role != "owner" {
			writeError(w, http.StatusForbidden, "forbidden", "Only the Owner can do this.", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requireAnalytics must run after requireStaff: attendance analytics are for the Owner, admins and
// success coaches (NxtOne's /admin/attendance-analytics).
func (s *Server) requireAnalytics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if role := adminFrom(r.Context()).Role; role != "owner" && role != "admin" && role != "success_coach" {
			writeError(w, http.StatusForbidden, "forbidden", "Only the Owner, admins and success coaches can see attendance analytics.", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}
