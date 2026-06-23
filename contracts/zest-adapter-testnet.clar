;; zest-adapter-testnet.clar
;; Mock-free adapter surface for public testnet and future mainnet deployments

(use-trait ft-trait .sip-010-ft-trait.sip-010-ft-trait)

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-VAULT-CIRCLE (err u400))
(define-constant ERR-NOT-ADMIN (err u401))
(define-constant ERR-ZERO-AMOUNT (err u402))
(define-constant ERR-PAUSED (err u404))
(define-constant ERR-ALREADY-INITIALIZED (err u406))
(define-constant ERR-INVALID-MODE (err u408))
(define-constant ERR-ADAPTER-DISABLED (err u409))
(define-constant ERR-LIVE-ZEST-NOT-IMPLEMENTED (err u410))

(define-constant MODE-DISABLED u0)
(define-constant MODE-LIVE u2)

(define-data-var vault-circle-contract (optional principal) none)
(define-data-var adapter-admin principal CONTRACT-OWNER)
(define-data-var zest-deposit-paused bool false)
(define-data-var zest-withdraw-paused bool false)
(define-data-var adapter-mode uint MODE-DISABLED)
(define-data-var configured-zest-contract (optional principal) none)

(define-map vault-zest-allocated
  uint
  uint)

(define-map vault-position-value
  uint
  uint)

(define-private (is-vault-circle)
  (match (var-get vault-circle-contract)
    contract-principal (is-eq contract-caller contract-principal)
    false))

(define-private (is-admin)
  (is-eq tx-sender (var-get adapter-admin)))

(define-public (initialize (vault-circle principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-ADMIN)
    (asserts! (is-none (var-get vault-circle-contract)) ERR-ALREADY-INITIALIZED)
    (var-set vault-circle-contract (some vault-circle))
    (ok true)))

(define-public (configure-adapter (mode uint) (zest-contract (optional principal)))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (or (is-eq mode MODE-DISABLED) (is-eq mode MODE-LIVE)) ERR-INVALID-MODE)
    (if (is-eq mode MODE-LIVE)
      (asserts! (is-some zest-contract) ERR-INVALID-MODE)
      (asserts! (is-none zest-contract) ERR-INVALID-MODE))
    (var-set adapter-mode mode)
    (var-set configured-zest-contract zest-contract)
    (ok true)))

(define-public (deposit-to-zest (token <ft-trait>) (vault-id uint) (amount uint))
  (begin
    token
    vault-id
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CIRCLE)
    (asserts! (not (var-get zest-deposit-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (if (is-eq amount u0)
      (ok u0)
      (if (is-eq (var-get adapter-mode) MODE-DISABLED)
        ERR-ADAPTER-DISABLED
        ERR-LIVE-ZEST-NOT-IMPLEMENTED))))

(define-public (withdraw-from-zest (token <ft-trait>) (vault-id uint) (amount uint))
  (begin
    token
    vault-id
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CIRCLE)
    (asserts! (not (var-get zest-withdraw-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (if (is-eq amount u0)
      (ok u0)
      (if (is-eq (var-get adapter-mode) MODE-DISABLED)
        ERR-ADAPTER-DISABLED
        ERR-LIVE-ZEST-NOT-IMPLEMENTED))))

(define-public (sync-position (vault-id uint))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CIRCLE)
    (if (is-eq (var-get adapter-mode) MODE-DISABLED)
      (ok (default-to u0 (map-get? vault-position-value vault-id)))
      ERR-LIVE-ZEST-NOT-IMPLEMENTED)))

(define-read-only (get-vault-allocated (vault-id uint))
  (default-to u0 (map-get? vault-zest-allocated vault-id)))

(define-read-only (get-zest-allocated (vault-id uint))
  (default-to u0 (map-get? vault-zest-allocated vault-id)))

(define-read-only (get-position-value (vault-id uint))
  (default-to u0 (map-get? vault-position-value vault-id)))

(define-read-only (get-zest-position-value (vault-id uint))
  (default-to u0 (map-get? vault-position-value vault-id)))

(define-read-only (get-cached-position-value (vault-id uint))
  (default-to u0 (map-get? vault-position-value vault-id)))

(define-read-only (get-yield-earned (vault-id uint))
  u0)

(define-read-only (get-adapter-mode)
  (var-get adapter-mode))

(define-read-only (get-configured-zest-contract)
  (var-get configured-zest-contract))

(define-read-only (get-vault-circle-contract)
  (var-get vault-circle-contract))

(define-read-only (is-zest-deposit-paused)
  (var-get zest-deposit-paused))

(define-read-only (is-zest-withdraw-paused)
  (var-get zest-withdraw-paused))

(define-public (set-zest-deposit-paused (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set zest-deposit-paused value)
    (ok true)))

(define-public (set-zest-withdraw-paused (value bool))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set zest-withdraw-paused value)
    (ok true)))

(define-public (set-adapter-admin (new-admin principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (var-set adapter-admin new-admin)
    (ok true)))
