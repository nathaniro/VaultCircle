;; vault-registry.clar
;; Tracks vault metadata and user-to-vault membership indexes for frontend queries

(define-constant ERR-NOT-VAULT-CONTRACT (err u200))
(define-constant ERR-ALREADY-REGISTERED (err u202))

(define-data-var vault-circle-contract (optional principal) none)
(define-data-var total-vaults uint u0)

(define-map vault-creator
  uint
  principal)

(define-map vault-name
  uint
  (string-ascii 64))

(define-map vault-status
  uint
  (string-ascii 16))

(define-map vault-created-at
  uint
  uint)

(define-map vault-member-index
  {vault-id: uint, member: principal}
  bool)

(define-map member-vault-count
  principal
  uint)

(define-map member-vault-at
  {member: principal, idx: uint}
  uint)

(define-private (is-vault-circle)
  (match (var-get vault-circle-contract)
    contract-principal (is-eq contract-caller contract-principal)
    false))

(define-public (set-vault-circle-contract (addr principal))
  (begin
    (asserts! (is-none (var-get vault-circle-contract)) ERR-ALREADY-REGISTERED)
    (var-set vault-circle-contract (some addr))
    (ok true)))

(define-public (register-vault (vault-id uint) (creator principal) (name (string-ascii 64)))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CONTRACT)
    (map-set vault-creator vault-id creator)
    (map-set vault-name vault-id name)
    (map-set vault-status vault-id "ACTIVE")
    (map-set vault-created-at vault-id stacks-block-height)
    (var-set total-vaults (+ (var-get total-vaults) u1))
    (ok true)))

(define-public (add-member-to-vault (vault-id uint) (member principal))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CONTRACT)
    (if (default-to false (map-get? vault-member-index {vault-id: vault-id, member: member}))
      (ok true)
      (let ((idx (default-to u0 (map-get? member-vault-count member))))
        (map-set vault-member-index {vault-id: vault-id, member: member} true)
        (map-set member-vault-at {member: member, idx: idx} vault-id)
        (map-set member-vault-count member (+ idx u1))
        (ok true)))))

(define-public (remove-member-from-vault (vault-id uint) (member principal))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CONTRACT)
    (map-delete vault-member-index {vault-id: vault-id, member: member})
    (ok true)))

(define-public (update-vault-status (vault-id uint) (status (string-ascii 16)))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CONTRACT)
    (map-set vault-status vault-id status)
    (ok true)))

(define-read-only (get-total-vaults)
  (var-get total-vaults))

(define-read-only (get-vault-count)
  (var-get total-vaults))

(define-read-only (get-vault-circle-contract)
  (var-get vault-circle-contract))

(define-read-only (get-vault-creator (vault-id uint))
  (map-get? vault-creator vault-id))

(define-read-only (get-vault-name (vault-id uint))
  (map-get? vault-name vault-id))

(define-read-only (get-vault-status (vault-id uint))
  (map-get? vault-status vault-id))

(define-read-only (get-vault-created-at (vault-id uint))
  (map-get? vault-created-at vault-id))

(define-read-only (is-member-of-vault (vault-id uint) (member principal))
  (default-to false (map-get? vault-member-index {vault-id: vault-id, member: member})))

(define-read-only (get-member-vault-count (member principal))
  (default-to u0 (map-get? member-vault-count member)))

(define-read-only (get-member-vault-at (member principal) (idx uint))
  (map-get? member-vault-at {member: member, idx: idx}))

(define-read-only (get-member-vaults (member principal) (offset uint))
  (let ((count (default-to u0 (map-get? member-vault-count member))))
    {
      total: count,
      v0: (map-get? member-vault-at {member: member, idx: (+ offset u0)}),
      v1: (map-get? member-vault-at {member: member, idx: (+ offset u1)}),
      v2: (map-get? member-vault-at {member: member, idx: (+ offset u2)}),
      v3: (map-get? member-vault-at {member: member, idx: (+ offset u3)}),
      v4: (map-get? member-vault-at {member: member, idx: (+ offset u4)}),
      v5: (map-get? member-vault-at {member: member, idx: (+ offset u5)}),
      v6: (map-get? member-vault-at {member: member, idx: (+ offset u6)}),
      v7: (map-get? member-vault-at {member: member, idx: (+ offset u7)}),
      v8: (map-get? member-vault-at {member: member, idx: (+ offset u8)}),
      v9: (map-get? member-vault-at {member: member, idx: (+ offset u9)})
    }))

(define-read-only (get-user-vaults (member principal) (offset uint))
  (get-member-vaults member offset))

(define-read-only (get-vault-summary (vault-id uint))
  {
    vault-id: vault-id,
    creator: (map-get? vault-creator vault-id),
    name: (map-get? vault-name vault-id),
    status: (map-get? vault-status vault-id),
    created-at: (map-get? vault-created-at vault-id)
  })
