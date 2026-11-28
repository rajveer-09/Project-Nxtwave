// Package http holds the API router, handlers and middleware.
package http

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"attendance-dashboard/api/internal/db"
)

// Store is the sqlc Querier; *db.Queries satisfies it and unit tests use fakes.
type Store = db.Querier

type Deps struct {
	Log   *slog.Logger
	Store Store
	// Pool runs transactions (saving marks). Unit tests that never save may leave it nil.
	Pool *pgxpool.Pool
	// IdentitySecret verifies NxtOne's identity tokens (= ATTENDANCE_JWT_SECRET in NxtOne).
	IdentitySecret []byte
	Location       *time.Location // Asia/Kolkata
}

type Server struct {
	log            *slog.Logger
	store          Store
	pool           *pgxpool.Pool
	identitySecret []byte
	loc            *time.Location
	now            func() time.Time

	idsMu sync.Mutex
	ids   map[string]int64 // email -> attendance.admins id (adminID)
}

func NewServer(d Deps) *Server {
	return &Server{
		log:            d.Log,
		store:          d.Store,
		pool:           d.Pool,
		identitySecret: d.IdentitySecret,
		loc:            d.Location,
		now:            time.Now,
		ids:            map[string]int64{},
	}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(s.requestLogger)
	r.Use(middleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.handleHealth)
		r.Head("/health", s.handleHealth) // uptime pingers (cron-job.org) check it without a body

		// Everything else needs NxtOne's identity token (middleware.go); people sign in to NxtOne only.
		r.Route("/admin", func(r chi.Router) {
			r.Use(s.requireStaff)
			r.Get("/students", s.handleAdminStudents)
			r.Post("/students", s.handleCreateStudent)
			r.Get("/students/{niat_id}", s.handleAdminStudent)
			r.Put("/students/{niat_id}", s.handleUpdateStudent)
			r.With(s.requireOwner).Delete("/students/{niat_id}", s.handleDeleteStudent)
			r.With(s.requireOwner).Post("/students/bulk-delete", s.handleBulkDeleteStudents)
			r.Get("/students/{niat_id}/month", s.handleAdminStudentMonth)
			r.Get("/students/{niat_id}/range", s.handleAdminStudentRange)
			r.Put("/students/{niat_id}/remarks/{ym}", s.handleSetRemark)
			r.Get("/students/{niat_id}/periods", s.handleStudentPeriods)
			r.Post("/students/{niat_id}/internships", s.handleCreateInternship)
			r.Get("/internships", s.handleListInternships)
			r.Put("/internships/{id}", s.handleUpdateInternship)
			r.Post("/internships/{id}/cancel", s.handleCancelInternship)
			r.With(s.requireAnalytics).Get("/analytics", s.handleAnalytics)
			r.With(s.requireAnalytics).Get("/analytics/export.xlsx", s.handleAnalyticsExport)
			r.With(s.requireAnalytics).Get("/analytics/students", s.handleAnalyticsStudents)
			r.Get("/halls", s.handleListHalls)
			r.Get("/attendance/sheet", s.handleAdminSheet)
			r.Put("/attendance", s.handleSaveAttendance)
			r.Post("/imports/students", s.handleImportStudents)
			r.Post("/imports/attendance", s.handleImportAttendance)
			r.Post("/imports/calendar", s.handleImportCalendar)
			r.Get("/imports/history", s.handleImportHistory)
			r.Get("/exports/attendance", s.handleExportAttendance)
			r.Get("/exports/attendance.xlsx", s.handleExportAttendanceXLSX)
			r.Get("/terms", s.handleListTerms)
			r.Post("/terms", s.handleCreateTerm)
			r.Patch("/terms/{id}", s.handleUpdateTerm)
			r.Delete("/terms/{id}", s.handleDeleteTerm)
			r.Get("/calendar", s.handleCalendarMonth)
			r.Put("/calendar", s.handleSetCalendar)
			r.Get("/calendar/entries", s.handleListCalendarEntries)
			r.Put("/calendar/entries", s.handleSaveCalendarEntries)
			r.Patch("/calendar/entries", s.handleEditCalendarEntries)
			r.Post("/calendar/deletions/preview", s.handlePreviewCalendarDeletion)
			r.Post("/calendar/deletions", s.handleDeleteCalendarEntries)
			r.Get("/calendar/deletions", s.handleListCalendarDeletions)
			r.Get("/calendar/deletions/{id}", s.handleGetCalendarDeletion)
			r.Post("/calendar/deletions/{id}/restore", s.handleRestoreCalendarDeletion)
			r.Delete("/calendar", s.handleDeleteCalendar)
		})

		r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusNotFound, "not_found", "No such endpoint.", nil)
		})
		r.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed.", nil)
		})
	})
	return r
}

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		start := time.Now()
		next.ServeHTTP(ww, r)
		s.log.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", middleware.GetReqID(r.Context()),
		)
	})
}
