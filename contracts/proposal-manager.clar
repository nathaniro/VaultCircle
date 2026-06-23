;; proposal-manager.clar
;; Governance and voting engine for VaultCircle

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-VAULT-CIRCLE (err u500))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u502))
(define-constant ERR-ALREADY-VOTED (err u503))
(define-constant ERR-PROPOSAL-CLOSED (err u504))
(define-constant ERR-PROPOSAL-EXPIRED (err u505))
(define-constant ERR-PROPOSAL-NOT-PASSED (err u506))
(define-constant ERR-PROPOSAL-ALREADY-EXECUTED (err u507))
(define-constant ERR-ALREADY-INITIALIZED (err u509))
(define-constant ERR-INVALID-EXPIRY (err u510))
(define-constant ERR-INVALID-PROPOSAL-TYPE (err u512))

(define-constant PROPOSAL-WITHDRAW-SINGLE u1)
(define-constant PROPOSAL-WITHDRAW-BY-SHARE u2)
(define-constant PROPOSAL-ADD-MEMBER u3)
(define-constant PROPOSAL-REMOVE-MEMBER u4)
(define-constant PROPOSAL-CHANGE-THRESHOLD u5)
(define-constant PROPOSAL-ENABLE-YIELD u6)
(define-constant PROPOSAL-DISABLE-YIELD u7)
(define-constant PROPOSAL-DEPOSIT-TO-ZEST u8)
(define-constant PROPOSAL-WITHDRAW-FROM-ZEST u9)
(define-constant PROPOSAL-CHANGE-BENEFICIARY u10)
(define-constant PROPOSAL-CLOSE-VAULT u11)

(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-PASSED u2)
(define-constant STATUS-REJECTED u3)
(define-constant STATUS-EXECUTED u4)
(define-constant STATUS-EXPIRED u5)

(define-data-var vault-circle-contract (optional principal) none)
(define-data-var next-proposal-id uint u1)

(define-map proposals
  uint
  {
    vault-id: uint,
    proposer: principal,
    proposal-type: uint,
    amount: uint,
    recipient: (optional principal),
    reason: (string-ascii 256),
    approvals: uint,
    rejections: uint,
    status: uint,
    created-at: uint,
    expires-at: uint,
    executed: bool
  })

(define-map votes
  {proposal-id: uint, voter: principal}
  {vote: bool, voted-at: uint})

(define-map vault-proposal-count
  uint
  uint)

(define-map vault-proposal-at
  {vault-id: uint, idx: uint}
  uint)

(define-private (is-vault-circle)
  (match (var-get vault-circle-contract)
    contract-principal (is-eq contract-caller contract-principal)
    false))

(define-public (initialize (vault-circle principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-VAULT-CIRCLE)
    (asserts! (is-none (var-get vault-circle-contract)) ERR-ALREADY-INITIALIZED)
    (var-set vault-circle-contract (some vault-circle))
    (ok true)))

(define-read-only (calc-required-approvals (member-count uint) (threshold-pct uint))
  (let ((raw (* member-count threshold-pct)))
    (if (is-eq (mod raw u100) u0)
      (/ raw u100)
      (+ (/ raw u100) u1))))

(define-public (create-proposal
    (vault-id uint)
    (proposer principal)
    (proposal-type uint)
    (amount uint)
    (recipient (optional principal))
    (reason (string-ascii 256))
    (expires-at uint))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CIRCLE)
    (asserts! (> expires-at stacks-block-height) ERR-INVALID-EXPIRY)
    (asserts! (and (>= proposal-type u1) (<= proposal-type u11)) ERR-INVALID-PROPOSAL-TYPE)
    (let ((proposal-id (var-get next-proposal-id)))
      (map-set proposals proposal-id {
        vault-id: vault-id,
        proposer: proposer,
        proposal-type: proposal-type,
        amount: amount,
        recipient: recipient,
        reason: reason,
        approvals: u0,
        rejections: u0,
        status: STATUS-ACTIVE,
        created-at: stacks-block-height,
        expires-at: expires-at,
        executed: false
      })
      (let ((proposal-idx (default-to u0 (map-get? vault-proposal-count vault-id))))
        (map-set vault-proposal-at {vault-id: vault-id, idx: proposal-idx} proposal-id)
        (map-set vault-proposal-count vault-id (+ proposal-idx u1)))
      (var-set next-proposal-id (+ proposal-id u1))
      (print {
        event: "proposal-created",
        proposal-id: proposal-id,
        vault-id: vault-id,
        proposer: proposer,
        proposal-type: proposal-type,
        amount: amount,
        recipient: recipient,
        expires-at: expires-at,
        block: stacks-block-height
      })
      (ok proposal-id))))

(define-public (cast-vote
    (proposal-id uint)
    (voter principal)
    (approve bool)
    (member-count uint)
    (threshold-pct uint))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CIRCLE)
    (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
      (asserts! (is-eq (get status proposal) STATUS-ACTIVE) ERR-PROPOSAL-CLOSED)
      (asserts! (<= stacks-block-height (get expires-at proposal)) ERR-PROPOSAL-EXPIRED)
      (asserts! (is-none (map-get? votes {proposal-id: proposal-id, voter: voter})) ERR-ALREADY-VOTED)
      (map-set votes {proposal-id: proposal-id, voter: voter}
        {vote: approve, voted-at: stacks-block-height})
      (let (
        (new-approvals (if approve (+ (get approvals proposal) u1) (get approvals proposal)))
        (new-rejections (if approve (get rejections proposal) (+ (get rejections proposal) u1)))
        (required (calc-required-approvals member-count threshold-pct))
        (reject-threshold (+ (- member-count required) u1))
      )
        (print {
          event: "vote-cast",
          proposal-id: proposal-id,
          voter: voter,
          approve: approve,
          approvals: new-approvals,
          rejections: new-rejections,
          required: required,
          block: stacks-block-height
        })
        (if (>= new-approvals required)
          (begin
            (map-set proposals proposal-id
              (merge proposal {
                approvals: new-approvals,
                rejections: new-rejections,
                status: STATUS-PASSED
              }))
            (print {event: "proposal-passed", proposal-id: proposal-id, block: stacks-block-height})
            (ok STATUS-PASSED))
          (if (>= new-rejections reject-threshold)
            (begin
              (map-set proposals proposal-id
                (merge proposal {
                  approvals: new-approvals,
                  rejections: new-rejections,
                  status: STATUS-REJECTED
                }))
              (print {event: "proposal-rejected", proposal-id: proposal-id, block: stacks-block-height})
              (ok STATUS-REJECTED))
            (begin
              (map-set proposals proposal-id
                (merge proposal {
                  approvals: new-approvals,
                  rejections: new-rejections
                }))
              (ok STATUS-ACTIVE))))))))

(define-public (mark-executed (proposal-id uint))
  (begin
    (asserts! (is-vault-circle) ERR-NOT-VAULT-CIRCLE)
    (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
      (asserts! (is-eq (get status proposal) STATUS-PASSED) ERR-PROPOSAL-NOT-PASSED)
      (asserts! (not (get executed proposal)) ERR-PROPOSAL-ALREADY-EXECUTED)
      (map-set proposals proposal-id
        (merge proposal {status: STATUS-EXECUTED, executed: true}))
      (print {event: "proposal-executed", proposal-id: proposal-id, block: stacks-block-height})
      (ok true))))

(define-public (mark-expired (proposal-id uint))
  (begin
    (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
      (asserts! (is-eq (get status proposal) STATUS-ACTIVE) ERR-PROPOSAL-CLOSED)
      (asserts! (> stacks-block-height (get expires-at proposal)) ERR-PROPOSAL-EXPIRED)
      (map-set proposals proposal-id (merge proposal {status: STATUS-EXPIRED}))
      (ok true))))

(define-read-only (can-execute (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal
      (and
        (is-eq (get status proposal) STATUS-PASSED)
        (not (get executed proposal))
        (<= stacks-block-height (get expires-at proposal)))
    false))

(define-read-only (has-voted (proposal-id uint) (voter principal))
  (is-some (map-get? votes {proposal-id: proposal-id, voter: voter})))

(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes {proposal-id: proposal-id, voter: voter}))

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id))

(define-read-only (get-next-proposal-id)
  (var-get next-proposal-id))

(define-read-only (get-vault-circle-contract)
  (var-get vault-circle-contract))

(define-read-only (get-vault-proposal-count (vault-id uint))
  (default-to u0 (map-get? vault-proposal-count vault-id)))

(define-read-only (get-vault-proposal-at (vault-id uint) (idx uint))
  (map-get? vault-proposal-at {vault-id: vault-id, idx: idx}))

(define-read-only (get-vault-proposals (vault-id uint) (offset uint))
  (let ((count (default-to u0 (map-get? vault-proposal-count vault-id))))
    {
      total: count,
      p0: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u0)}),
      p1: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u1)}),
      p2: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u2)}),
      p3: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u3)}),
      p4: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u4)}),
      p5: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u5)}),
      p6: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u6)}),
      p7: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u7)}),
      p8: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u8)}),
      p9: (map-get? vault-proposal-at {vault-id: vault-id, idx: (+ offset u9)})
    }))
