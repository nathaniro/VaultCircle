;; governance-params.clar
;; Protocol-level configuration and emergency controls for VaultCircle

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-ADMIN (err u100))
(define-constant ERR-INVALID-THRESHOLD (err u101))
(define-constant ERR-INVALID-ALLOCATION (err u102))
(define-constant ERR-INVALID-EXPIRY (err u103))

(define-data-var protocol-admin principal CONTRACT-OWNER)

(define-data-var min-threshold uint u51)
(define-data-var max-threshold uint u100)
(define-data-var default-threshold uint u70)

(define-data-var max-zest-allocation-pct uint u70)
(define-data-var min-liquid-reserve-pct uint u30)

(define-data-var min-proposal-expiry-blocks uint u144)
(define-data-var max-proposal-expiry-blocks uint u4320)
(define-data-var default-proposal-expiry-blocks uint u1008)

(define-data-var pause-deposits bool false)
(define-data-var pause-proposals bool false)
(define-data-var pause-zest-deposits bool false)
(define-data-var pause-zest-withdrawals bool false)
(define-data-var pause-executions bool false)

(define-private (is-admin)
  (is-eq tx-sender (var-get protocol-admin)))

(define-read-only (get-protocol-admin)
  (var-get protocol-admin))

(define-read-only (get-min-threshold)
  (var-get min-threshold))

(define-read-only (get-max-threshold)
  (var-get max-threshold))

(define-read-only (get-default-threshold)
  (var-get default-threshold))

(define-read-only (get-max-zest-allocation-pct)
  (var-get max-zest-allocation-pct))

(define-read-only (get-min-liquid-reserve-pct)
  (var-get min-liquid-reserve-pct))

(define-read-only (get-min-proposal-expiry-blocks)
  (var-get min-proposal-expiry-blocks))

(define-read-only (get-max-proposal-expiry-blocks)
  (var-get max-proposal-expiry-blocks))

(define-read-only (get-default-proposal-expiry-blocks)
  (var-get default-proposal-expiry-blocks))

(define-read-only (is-deposits-paused)
  (var-get pause-deposits))

(define-read-only (is-proposals-paused)
  (var-get pause-proposals))

(define-read-only (is-zest-deposits-paused)
  (var-get pause-zest-deposits))

(define-read-only (is-zest-withdrawals-paused)
  (var-get pause-zest-withdrawals))

(define-read-only (is-executions-paused)
  (var-get pause-executions))

(define-read-only (is-any-paused)
  (or
    (var-get pause-deposits)
    (var-get pause-proposals)
    (var-get pause-zest-deposits)
    (var-get pause-zest-withdrawals)
    (var-get pause-executions)))

(define-read-only (get-config-summary)
  {
    protocol-admin: (var-get protocol-admin),
    min-threshold: (var-get min-threshold),
    max-threshold: (var-get max-threshold),
    default-threshold: (var-get default-threshold),
    max-zest-allocation-pct: (var-get max-zest-allocation-pct),
    min-liquid-reserve-pct: (var-get min-liquid-reserve-pct),
    min-proposal-expiry-blocks: (var-get min-proposal-expiry-blocks),
    max-proposal-expiry-blocks: (var-get max-proposal-expiry-blocks),
    default-proposal-expiry-blocks: (var-get default-proposal-expiry-blocks),
    pause-deposits: (var-get pause-deposits),
    pause-proposals: (var-get pause-proposals),
    pause-zest-deposits: (var-get pause-zest-deposits),
    pause-zest-withdrawals: (var-get pause-zest-withdrawals),
    pause-executions: (var-get pause-executions)
  })

(define-public (set-protocol-admin (new-admin principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set protocol-admin new-admin)
    (ok true)))

(define-public (set-min-threshold (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (and (>= value u1) (<= value u100)) ERR-INVALID-THRESHOLD)
    (var-set min-threshold value)
    (ok true)))

(define-public (set-max-threshold (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (and (>= value u1) (<= value u100)) ERR-INVALID-THRESHOLD)
    (var-set max-threshold value)
    (ok true)))

(define-public (set-default-threshold (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts!
      (and
        (>= value (var-get min-threshold))
        (<= value (var-get max-threshold)))
      ERR-INVALID-THRESHOLD)
    (var-set default-threshold value)
    (ok true)))

(define-public (set-max-zest-allocation-pct (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (and (>= value u1) (<= value u100)) ERR-INVALID-ALLOCATION)
    (var-set max-zest-allocation-pct value)
    (ok true)))

(define-public (set-min-liquid-reserve-pct (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (and (>= value u0) (<= value u100)) ERR-INVALID-ALLOCATION)
    (var-set min-liquid-reserve-pct value)
    (ok true)))

(define-public (set-min-proposal-expiry-blocks (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (> value u0) ERR-INVALID-EXPIRY)
    (var-set min-proposal-expiry-blocks value)
    (ok true)))

(define-public (set-max-proposal-expiry-blocks (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (> value u0) ERR-INVALID-EXPIRY)
    (var-set max-proposal-expiry-blocks value)
    (ok true)))

(define-public (set-default-proposal-expiry-blocks (value uint))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts!
      (and
        (>= value (var-get min-proposal-expiry-blocks))
        (<= value (var-get max-proposal-expiry-blocks)))
      ERR-INVALID-EXPIRY)
    (var-set default-proposal-expiry-blocks value)
    (ok true)))

(define-public (pause-all)
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-deposits true)
    (var-set pause-proposals true)
    (var-set pause-zest-deposits true)
    (var-set pause-zest-withdrawals true)
    (var-set pause-executions true)
    (print {event: "emergency-paused", admin: tx-sender, block: stacks-block-height})
    (ok true)))

(define-public (unpause-all)
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-deposits false)
    (var-set pause-proposals false)
    (var-set pause-zest-deposits false)
    (var-set pause-zest-withdrawals false)
    (var-set pause-executions false)
    (print {event: "emergency-unpaused", admin: tx-sender, block: stacks-block-height})
    (ok true)))

(define-public (set-pause-deposits (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-deposits value)
    (ok true)))

(define-public (set-pause-proposals (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-proposals value)
    (ok true)))

(define-public (set-pause-zest-deposits (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-zest-deposits value)
    (ok true)))

(define-public (set-pause-zest-withdrawals (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-zest-withdrawals value)
    (ok true)))

(define-public (set-pause-executions (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set pause-executions value)
    (ok true)))
