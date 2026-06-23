;; vault-circle.clar
;; Main VaultCircle contract with configurable SIP-010 sBTC custody

(use-trait ft-trait .sip-010-ft-trait.sip-010-ft-trait)

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-MEMBER (err u601))
(define-constant ERR-VAULT-NOT-FOUND (err u602))
(define-constant ERR-ALREADY-MEMBER (err u603))
(define-constant ERR-INVALID-THRESHOLD (err u604))
(define-constant ERR-VAULT-CLOSED (err u605))
(define-constant ERR-INSUFFICIENT-BALANCE (err u606))
(define-constant ERR-ZERO-AMOUNT (err u607))
(define-constant ERR-DEPOSITS-PAUSED (err u608))
(define-constant ERR-PROPOSALS-PAUSED (err u609))
(define-constant ERR-EXECUTIONS-PAUSED (err u610))
(define-constant ERR-ZEST-DEPOSITS-PAUSED (err u611))
(define-constant ERR-ZEST-WITHDRAWALS-PAUSED (err u612))
(define-constant ERR-PROPOSAL-NOT-READY (err u613))
(define-constant ERR-EXCEEDS-ZEST-CAP (err u614))
(define-constant ERR-MAX-MEMBERS-REACHED (err u615))
(define-constant ERR-INVALID-NAME (err u617))
(define-constant ERR-YIELD-NOT-ENABLED (err u618))
(define-constant ERR-SELF-REMOVAL (err u619))
(define-constant ERR-MIN-MEMBERS (err u620))
(define-constant ERR-TOO-MANY-INITIAL-MEMBERS (err u622))
(define-constant ERR-MEMBER-NOT-FOUND (err u623))
(define-constant ERR-INVALID-PROPOSAL-PARAMS (err u625))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u626))
(define-constant ERR-PROPOSAL-VAULT-MISMATCH (err u627))
(define-constant ERR-NOT-INITIALIZED (err u628))
(define-constant ERR-INVALID-ASSET (err u629))
(define-constant ERR-BELOW-LIQUID-RESERVE (err u630))
(define-constant ERR-NOT-ADMIN (err u631))
(define-constant ERR-ALREADY-INITIALIZED (err u632))

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

(define-constant STATUS-ACTIVE "ACTIVE")
(define-constant STATUS-CLOSED "CLOSED")

(define-constant MAX-MEMBERS u50)
(define-constant MAX-INITIAL-MEMBERS u10)

(define-constant MEMBER-SLOTS
  (list
    u0 u1 u2 u3 u4 u5 u6 u7 u8 u9
    u10 u11 u12 u13 u14 u15 u16 u17 u18 u19
    u20 u21 u22 u23 u24 u25 u26 u27 u28 u29
    u30 u31 u32 u33 u34 u35 u36 u37 u38 u39
    u40 u41 u42 u43 u44 u45 u46 u47 u48 u49))

(define-data-var next-vault-id uint u1)
(define-data-var protocol-initialized bool false)
(define-data-var configured-sbtc-contract (optional principal) none)

(define-map vaults
  uint
  {
    name: (string-ascii 64),
    creator: principal,
    asset-contract: principal,
    threshold-percent: uint,
    member-count: uint,
    member-index-count: uint,
    liquid-balance: uint,
    zest-allocated: uint,
    total-contributed: uint,
    yield-enabled: bool,
    beneficiary: (optional principal),
    status: (string-ascii 16)
  })

(define-map members
  {vault-id: uint, member: principal}
  {
    contributed: uint,
    active: bool,
    joined-at: uint
  })

(define-map vault-member-at
  {vault-id: uint, idx: uint}
  principal)

(define-private (is-admin)
  (is-eq tx-sender (contract-call? .governance-params get-protocol-admin)))

(define-private (is-protocol-initialized)
  (var-get protocol-initialized))

(define-private (vault-exists (vault-id uint))
  (is-some (map-get? vaults vault-id)))

(define-private (get-vault-data (vault-id uint))
  (unwrap-panic (map-get? vaults vault-id)))

(define-private (member-record (vault-id uint) (member principal))
  (map-get? members {vault-id: vault-id, member: member}))

(define-private (is-member-recorded (vault-id uint) (member principal))
  (is-some (member-record vault-id member)))

(define-private (is-active-member-internal (vault-id uint) (member principal))
  (match (member-record vault-id member)
    record (get active record)
    false))

(define-private (vault-is-active (vault-id uint))
  (is-eq (get status (get-vault-data vault-id)) STATUS-ACTIVE))

(define-private (ceil-div (a uint) (b uint))
  (if (is-eq (mod a b) u0)
    (/ a b)
    (+ (/ a b) u1)))

(define-private (calc-required-approvals-internal (member-count uint) (threshold-pct uint))
  (ceil-div (* member-count threshold-pct) u100))

(define-private (get-total-vault-value-internal (vault-id uint))
  (+ (get liquid-balance (get-vault-data vault-id))
     (contract-call? .zest-adapter get-zest-position-value vault-id)))

(define-private (assert-token-matches-configured (token <ft-trait>))
  (match (var-get configured-sbtc-contract)
    configured-contract
      (if (is-eq (contract-of token) configured-contract)
        (ok true)
        ERR-INVALID-ASSET)
    ERR-INVALID-ASSET))

(define-private (assert-token-matches-vault (token <ft-trait>) (vault-id uint))
  (if (is-eq (contract-of token) (get asset-contract (get-vault-data vault-id)))
    (ok true)
    ERR-INVALID-ASSET))

(define-private (record-zest-withdrawal-to-liquid (vault-id uint) (amount uint))
  (let ((vault-data (get-vault-data vault-id)))
    (map-set vaults vault-id
      (merge vault-data {
        liquid-balance: (+ (get liquid-balance vault-data) amount),
        zest-allocated: (if (>= (get zest-allocated vault-data) amount)
          (- (get zest-allocated vault-data) amount)
          u0)
      }))
    true))

(define-private (ensure-liquid-balance (token <ft-trait>) (vault-id uint) (amount uint))
  (let ((vault-data (get-vault-data vault-id)))
    (if (< (get liquid-balance vault-data) amount)
      (let ((needed (- amount (get liquid-balance vault-data))))
        (asserts! (not (contract-call? .governance-params is-zest-withdrawals-paused)) ERR-ZEST-WITHDRAWALS-PAUSED)
        (try! (contract-call? .zest-adapter withdraw-from-zest token vault-id needed))
        (record-zest-withdrawal-to-liquid vault-id needed)
        (ok true))
      (ok true))))

(define-private (validate-proposal-params (vault-id uint) (proposal-type uint) (amount uint) (recipient (optional principal)))
  (let ((vault-data (get-vault-data vault-id)))
    (if (is-eq proposal-type PROPOSAL-WITHDRAW-SINGLE)
      (if (and (> amount u0) (is-some recipient))
        (ok true)
        ERR-INVALID-PROPOSAL-PARAMS)
      (if (is-eq proposal-type PROPOSAL-WITHDRAW-BY-SHARE)
        (if (and (> amount u0) (is-none recipient))
          (ok true)
          ERR-INVALID-PROPOSAL-PARAMS)
        (if (is-eq proposal-type PROPOSAL-ADD-MEMBER)
          (match recipient
            new-member
              (if (and
                    (is-eq amount u0)
                    (not (is-member-recorded vault-id new-member))
                    (< (get member-count vault-data) MAX-MEMBERS))
                (ok true)
                ERR-INVALID-PROPOSAL-PARAMS)
            ERR-INVALID-PROPOSAL-PARAMS)
          (if (is-eq proposal-type PROPOSAL-REMOVE-MEMBER)
            (match recipient
              target-member
                (if (is-eq target-member tx-sender)
                  ERR-SELF-REMOVAL
                  (if (and
                        (is-eq amount u0)
                        (> (get member-count vault-data) u1)
                        (is-active-member-internal vault-id target-member))
                    (ok true)
                    ERR-INVALID-PROPOSAL-PARAMS))
              ERR-INVALID-PROPOSAL-PARAMS)
            (if (is-eq proposal-type PROPOSAL-CHANGE-THRESHOLD)
              (if (and
                    (is-none recipient)
                    (>= amount (contract-call? .governance-params get-min-threshold))
                    (<= amount (contract-call? .governance-params get-max-threshold)))
                (ok true)
                ERR-INVALID-PROPOSAL-PARAMS)
              (if (is-eq proposal-type PROPOSAL-ENABLE-YIELD)
                (if (and (is-eq amount u0) (is-none recipient))
                  (ok true)
                  ERR-INVALID-PROPOSAL-PARAMS)
                (if (is-eq proposal-type PROPOSAL-DISABLE-YIELD)
                  (if (and (is-eq amount u0) (is-none recipient))
                    (ok true)
                    ERR-INVALID-PROPOSAL-PARAMS)
                  (if (is-eq proposal-type PROPOSAL-DEPOSIT-TO-ZEST)
                    (if (and (> amount u0) (is-none recipient))
                      (ok true)
                      ERR-INVALID-PROPOSAL-PARAMS)
                    (if (is-eq proposal-type PROPOSAL-WITHDRAW-FROM-ZEST)
                      (if (and (> amount u0) (is-none recipient))
                        (ok true)
                        ERR-INVALID-PROPOSAL-PARAMS)
                      (if (is-eq proposal-type PROPOSAL-CHANGE-BENEFICIARY)
                        (if (is-eq amount u0)
                          (ok true)
                          ERR-INVALID-PROPOSAL-PARAMS)
                        (if (is-eq proposal-type PROPOSAL-CLOSE-VAULT)
                          (if (and (is-eq amount u0) (is-none recipient))
                            (ok true)
                            ERR-INVALID-PROPOSAL-PARAMS)
                          ERR-INVALID-PROPOSAL-PARAMS)))))))))))))

(define-private (distribute-share-to-member
    (token <ft-trait>)
    (member principal)
    (member-data {contributed: uint, active: bool, joined-at: uint})
    (state {
      vault-id: uint,
      slot-count: uint,
      remaining-amount: uint,
      remaining-contributed: uint,
      paid-total: uint
    }))
  (let ((contributed (get contributed member-data)))
    (if (is-eq contributed u0)
      (ok state)
      (let (
        (remaining-contributed (get remaining-contributed state))
        (remaining-amount (get remaining-amount state))
        (payout (if (is-eq contributed remaining-contributed)
          remaining-amount
          (/ (* remaining-amount contributed) remaining-contributed)))
        (next-state {
          vault-id: (get vault-id state),
          slot-count: (get slot-count state),
          remaining-amount: (if (>= remaining-amount payout)
            (- remaining-amount payout)
            u0),
          remaining-contributed: (if (>= remaining-contributed contributed)
            (- remaining-contributed contributed)
            u0),
          paid-total: (+ (get paid-total state) payout)
        })
      )
        (if (is-eq payout u0)
          (ok next-state)
          (begin
            (try! (contract-call? token transfer payout (as-contract tx-sender) member none))
            (ok next-state)))))))

(define-private (distribute-share-step
    (token <ft-trait>)
    (idx uint)
    (acc (response {
      vault-id: uint,
      slot-count: uint,
      remaining-amount: uint,
      remaining-contributed: uint,
      paid-total: uint
    } uint)))
  (match acc
    state
      (if (or
            (>= idx (get slot-count state))
            (is-eq (get remaining-amount state) u0)
            (is-eq (get remaining-contributed state) u0))
        (ok state)
        (match (map-get? vault-member-at {vault-id: (get vault-id state), idx: idx})
          member
            (match (map-get? members {vault-id: (get vault-id state), member: member})
              member-data (distribute-share-to-member token member member-data state)
              (ok state))
          (ok state)))
    err-code (err err-code)))

(define-private (distribute-by-share (token <ft-trait>) (vault-id uint) (total-amount uint))
  (let (
    (vault-data (get-vault-data vault-id))
    (total-contributed (get total-contributed vault-data))
  )
    (let (
      (s0  (try! (distribute-share-step token u0  (ok {vault-id: vault-id, slot-count: (get member-index-count vault-data), remaining-amount: total-amount, remaining-contributed: total-contributed, paid-total: u0}))))
      (s1  (try! (distribute-share-step token u1  (ok s0))))
      (s2  (try! (distribute-share-step token u2  (ok s1))))
      (s3  (try! (distribute-share-step token u3  (ok s2))))
      (s4  (try! (distribute-share-step token u4  (ok s3))))
      (s5  (try! (distribute-share-step token u5  (ok s4))))
      (s6  (try! (distribute-share-step token u6  (ok s5))))
      (s7  (try! (distribute-share-step token u7  (ok s6))))
      (s8  (try! (distribute-share-step token u8  (ok s7))))
      (s9  (try! (distribute-share-step token u9  (ok s8))))
      (s10 (try! (distribute-share-step token u10 (ok s9))))
      (s11 (try! (distribute-share-step token u11 (ok s10))))
      (s12 (try! (distribute-share-step token u12 (ok s11))))
      (s13 (try! (distribute-share-step token u13 (ok s12))))
      (s14 (try! (distribute-share-step token u14 (ok s13))))
      (s15 (try! (distribute-share-step token u15 (ok s14))))
      (s16 (try! (distribute-share-step token u16 (ok s15))))
      (s17 (try! (distribute-share-step token u17 (ok s16))))
      (s18 (try! (distribute-share-step token u18 (ok s17))))
      (s19 (try! (distribute-share-step token u19 (ok s18))))
      (s20 (try! (distribute-share-step token u20 (ok s19))))
      (s21 (try! (distribute-share-step token u21 (ok s20))))
      (s22 (try! (distribute-share-step token u22 (ok s21))))
      (s23 (try! (distribute-share-step token u23 (ok s22))))
      (s24 (try! (distribute-share-step token u24 (ok s23))))
      (s25 (try! (distribute-share-step token u25 (ok s24))))
      (s26 (try! (distribute-share-step token u26 (ok s25))))
      (s27 (try! (distribute-share-step token u27 (ok s26))))
      (s28 (try! (distribute-share-step token u28 (ok s27))))
      (s29 (try! (distribute-share-step token u29 (ok s28))))
      (s30 (try! (distribute-share-step token u30 (ok s29))))
      (s31 (try! (distribute-share-step token u31 (ok s30))))
      (s32 (try! (distribute-share-step token u32 (ok s31))))
      (s33 (try! (distribute-share-step token u33 (ok s32))))
      (s34 (try! (distribute-share-step token u34 (ok s33))))
      (s35 (try! (distribute-share-step token u35 (ok s34))))
      (s36 (try! (distribute-share-step token u36 (ok s35))))
      (s37 (try! (distribute-share-step token u37 (ok s36))))
      (s38 (try! (distribute-share-step token u38 (ok s37))))
      (s39 (try! (distribute-share-step token u39 (ok s38))))
      (s40 (try! (distribute-share-step token u40 (ok s39))))
      (s41 (try! (distribute-share-step token u41 (ok s40))))
      (s42 (try! (distribute-share-step token u42 (ok s41))))
      (s43 (try! (distribute-share-step token u43 (ok s42))))
      (s44 (try! (distribute-share-step token u44 (ok s43))))
      (s45 (try! (distribute-share-step token u45 (ok s44))))
      (s46 (try! (distribute-share-step token u46 (ok s45))))
      (s47 (try! (distribute-share-step token u47 (ok s46))))
      (s48 (try! (distribute-share-step token u48 (ok s47))))
      (final-state (try! (distribute-share-step token u49 (ok s48))))
    )
      (if (and
            (is-eq (get remaining-amount final-state) u0)
            (is-eq (get remaining-contributed final-state) u0))
        (ok (get paid-total final-state))
        ERR-INSUFFICIENT-BALANCE))))

(define-private (add-initial-member
    (member principal)
    (state {vault-id: uint, count: uint}))
  (let (
    (vault-id (get vault-id state))
    (count (get count state))
  )
    (if (or
          (is-eq member tx-sender)
          (is-member-recorded vault-id member))
      state
      (begin
        (map-set members {vault-id: vault-id, member: member}
          {contributed: u0, active: true, joined-at: stacks-block-height})
        (map-set vault-member-at {vault-id: vault-id, idx: count} member)
        (unwrap-panic (contract-call? .vault-registry add-member-to-vault vault-id member))
        (print {event: "member-added", vault-id: vault-id, member: member, block: stacks-block-height})
        {vault-id: vault-id, count: (+ count u1)}))))

(define-public (initialize-protocol (sbtc-contract principal))
  (begin
    (asserts! (is-admin) ERR-NOT-ADMIN)
    (asserts! (not (var-get protocol-initialized)) ERR-ALREADY-INITIALIZED)
    (var-set configured-sbtc-contract (some sbtc-contract))
    (var-set protocol-initialized true)
    (print {event: "protocol-initialized", sbtc-contract: sbtc-contract, block: stacks-block-height})
    (ok true)))

(define-public (create-vault
    (name (string-ascii 64))
    (initial-members (list 10 principal))
    (threshold-percent uint)
    (yield-enabled bool)
    (beneficiary (optional principal)))
  (begin
    (asserts! (is-protocol-initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (contract-call? .governance-params is-deposits-paused)) ERR-DEPOSITS-PAUSED)
    (asserts! (> (len name) u0) ERR-INVALID-NAME)
    (asserts!
      (and
        (>= threshold-percent (contract-call? .governance-params get-min-threshold))
        (<= threshold-percent (contract-call? .governance-params get-max-threshold)))
      ERR-INVALID-THRESHOLD)
    (asserts! (<= (len initial-members) MAX-INITIAL-MEMBERS) ERR-TOO-MANY-INITIAL-MEMBERS)
    (match (var-get configured-sbtc-contract)
      asset-contract
        (let ((vault-id (var-get next-vault-id)))
          (map-set vaults vault-id {
            name: name,
            creator: tx-sender,
            asset-contract: asset-contract,
            threshold-percent: threshold-percent,
            member-count: u1,
            member-index-count: u1,
            liquid-balance: u0,
            zest-allocated: u0,
            total-contributed: u0,
            yield-enabled: yield-enabled,
            beneficiary: beneficiary,
            status: STATUS-ACTIVE
          })
          (map-set members {vault-id: vault-id, member: tx-sender}
            {contributed: u0, active: true, joined-at: stacks-block-height})
          (map-set vault-member-at {vault-id: vault-id, idx: u0} tx-sender)
          (try! (contract-call? .vault-registry register-vault vault-id tx-sender name))
          (try! (contract-call? .vault-registry add-member-to-vault vault-id tx-sender))
          (let ((final-state (fold add-initial-member initial-members {vault-id: vault-id, count: u1})))
            (map-set vaults vault-id
              (merge (get-vault-data vault-id) {
                member-count: (get count final-state),
                member-index-count: (get count final-state)
              }))
            (var-set next-vault-id (+ vault-id u1))
            (print {
              event: "vault-created",
              vault-id: vault-id,
              asset-contract: asset-contract,
              creator: tx-sender,
              name: name,
              threshold-percent: threshold-percent,
              member-count: (get count final-state),
              yield-enabled: yield-enabled,
              block: stacks-block-height
            })
            (ok vault-id)))
      ERR-NOT-INITIALIZED)))

(define-public (deposit (token <ft-trait>) (vault-id uint) (amount uint))
  (begin
    (asserts! (is-protocol-initialized) ERR-NOT-INITIALIZED)
    (asserts! (vault-exists vault-id) ERR-VAULT-NOT-FOUND)
    (asserts! (vault-is-active vault-id) ERR-VAULT-CLOSED)
    (asserts! (is-active-member-internal vault-id tx-sender) ERR-NOT-MEMBER)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (not (contract-call? .governance-params is-deposits-paused)) ERR-DEPOSITS-PAUSED)
    (try! (assert-token-matches-configured token))
    (try! (assert-token-matches-vault token vault-id))
    (let (
      (vault-data (get-vault-data vault-id))
      (member-data (unwrap! (member-record vault-id tx-sender) ERR-NOT-MEMBER))
    )
      (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
      (map-set members {vault-id: vault-id, member: tx-sender}
        (merge member-data {contributed: (+ (get contributed member-data) amount)}))
      (map-set vaults vault-id
        (merge vault-data {
          liquid-balance: (+ (get liquid-balance vault-data) amount),
          total-contributed: (+ (get total-contributed vault-data) amount)
        }))
      (print {
        event: "deposit-made",
        vault-id: vault-id,
        asset-contract: (contract-of token),
        member: tx-sender,
        amount: amount,
        block: stacks-block-height
      })
      (ok (+ (get liquid-balance vault-data) amount)))))

(define-public (create-proposal
    (vault-id uint)
    (proposal-type uint)
    (amount uint)
    (recipient (optional principal))
    (reason (string-ascii 256))
    (duration-blocks uint))
  (begin
    (asserts! (is-protocol-initialized) ERR-NOT-INITIALIZED)
    (asserts! (vault-exists vault-id) ERR-VAULT-NOT-FOUND)
    (asserts! (vault-is-active vault-id) ERR-VAULT-CLOSED)
    (asserts! (is-active-member-internal vault-id tx-sender) ERR-NOT-MEMBER)
    (asserts! (not (contract-call? .governance-params is-proposals-paused)) ERR-PROPOSALS-PAUSED)
    (asserts!
      (and
        (>= duration-blocks (contract-call? .governance-params get-min-proposal-expiry-blocks))
        (<= duration-blocks (contract-call? .governance-params get-max-proposal-expiry-blocks)))
      ERR-PROPOSALS-PAUSED)
    (try! (validate-proposal-params vault-id proposal-type amount recipient))
    (let ((expires-at (+ stacks-block-height duration-blocks)))
      (contract-call? .proposal-manager create-proposal
        vault-id
        tx-sender
        proposal-type
        amount
        recipient
        reason
        expires-at))))

(define-public (vote-on-proposal (vault-id uint) (proposal-id uint) (approve bool))
  (begin
    (asserts! (is-protocol-initialized) ERR-NOT-INITIALIZED)
    (asserts! (vault-exists vault-id) ERR-VAULT-NOT-FOUND)
    (asserts! (vault-is-active vault-id) ERR-VAULT-CLOSED)
    (asserts! (is-active-member-internal vault-id tx-sender) ERR-NOT-MEMBER)
    (let (
      (vault-data (get-vault-data vault-id))
      (proposal (unwrap! (contract-call? .proposal-manager get-proposal proposal-id) ERR-PROPOSAL-NOT-FOUND))
    )
      (asserts! (is-eq (get vault-id proposal) vault-id) ERR-PROPOSAL-VAULT-MISMATCH)
      (contract-call? .proposal-manager cast-vote
        proposal-id
        tx-sender
        approve
        (get member-count vault-data)
        (get threshold-percent vault-data)))))

(define-public (execute-proposal (token <ft-trait>) (vault-id uint) (proposal-id uint))
  (begin
    (asserts! (is-protocol-initialized) ERR-NOT-INITIALIZED)
    (asserts! (vault-exists vault-id) ERR-VAULT-NOT-FOUND)
    (asserts! (vault-is-active vault-id) ERR-VAULT-CLOSED)
    (asserts! (is-active-member-internal vault-id tx-sender) ERR-NOT-MEMBER)
    (asserts! (not (contract-call? .governance-params is-executions-paused)) ERR-EXECUTIONS-PAUSED)
    (asserts! (contract-call? .proposal-manager can-execute proposal-id) ERR-PROPOSAL-NOT-READY)
    (try! (assert-token-matches-configured token))
    (try! (assert-token-matches-vault token vault-id))
    (let ((proposal (unwrap! (contract-call? .proposal-manager get-proposal proposal-id) ERR-PROPOSAL-NOT-FOUND)))
      (asserts! (is-eq (get vault-id proposal) vault-id) ERR-PROPOSAL-VAULT-MISMATCH)
      (let ((proposal-type (get proposal-type proposal)))
        (if (is-eq proposal-type PROPOSAL-WITHDRAW-SINGLE)
          (execute-withdraw-single token vault-id proposal-id proposal)
          (if (is-eq proposal-type PROPOSAL-WITHDRAW-BY-SHARE)
            (execute-withdraw-by-share token vault-id proposal-id proposal)
            (if (is-eq proposal-type PROPOSAL-ADD-MEMBER)
              (execute-add-member vault-id proposal-id proposal)
              (if (is-eq proposal-type PROPOSAL-REMOVE-MEMBER)
                (execute-remove-member vault-id proposal-id proposal)
                (if (is-eq proposal-type PROPOSAL-CHANGE-THRESHOLD)
                  (execute-change-threshold vault-id proposal-id proposal)
                  (if (is-eq proposal-type PROPOSAL-ENABLE-YIELD)
                    (execute-enable-yield vault-id proposal-id)
                    (if (is-eq proposal-type PROPOSAL-DISABLE-YIELD)
                      (execute-disable-yield vault-id proposal-id)
                      (if (is-eq proposal-type PROPOSAL-DEPOSIT-TO-ZEST)
                        (execute-deposit-to-zest token vault-id proposal-id proposal)
                        (if (is-eq proposal-type PROPOSAL-WITHDRAW-FROM-ZEST)
                          (execute-withdraw-from-zest token vault-id proposal-id proposal)
                          (if (is-eq proposal-type PROPOSAL-CHANGE-BENEFICIARY)
                            (execute-change-beneficiary vault-id proposal-id proposal)
                            (if (is-eq proposal-type PROPOSAL-CLOSE-VAULT)
                              (execute-close-vault token vault-id proposal-id)
                              ERR-PROPOSAL-NOT-READY)))))))))))))))

(define-private (execute-withdraw-single
    (token <ft-trait>)
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (amount (get amount proposal))
    (recipient (unwrap! (get recipient proposal) ERR-INVALID-PROPOSAL-PARAMS))
  )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= (get-total-vault-value-internal vault-id) amount) ERR-INSUFFICIENT-BALANCE)
    (try! (ensure-liquid-balance token vault-id amount))
    (try! (contract-call? token transfer amount (as-contract tx-sender) recipient none))
    (let ((vault-data (get-vault-data vault-id)))
      (map-set vaults vault-id
        (merge vault-data {liquid-balance: (- (get liquid-balance vault-data) amount)}))
      (try! (contract-call? .proposal-manager mark-executed proposal-id))
      (print {
        event: "withdrawal-executed",
        vault-id: vault-id,
        proposal-id: proposal-id,
        amount: amount,
        recipient: recipient,
        block: stacks-block-height
      })
      (ok true))))

(define-private (execute-withdraw-by-share
    (token <ft-trait>)
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (total-amount (get amount proposal))
    (vault-data (get-vault-data vault-id))
    (total-contributed (get total-contributed vault-data))
  )
    (asserts! (> total-amount u0) ERR-ZERO-AMOUNT)
    (asserts! (> total-contributed u0) ERR-INSUFFICIENT-BALANCE)
    (asserts! (>= (get-total-vault-value-internal vault-id) total-amount) ERR-INSUFFICIENT-BALANCE)
    (try! (ensure-liquid-balance token vault-id total-amount))
    (try! (distribute-by-share token vault-id total-amount))
    (let ((updated-vault (get-vault-data vault-id)))
      (map-set vaults vault-id
        (merge updated-vault {liquid-balance: (- (get liquid-balance updated-vault) total-amount)}))
      (try! (contract-call? .proposal-manager mark-executed proposal-id))
      (print {
        event: "share-distribution-executed",
        vault-id: vault-id,
        proposal-id: proposal-id,
        total-amount: total-amount,
        block: stacks-block-height
      })
      (ok true))))

(define-private (execute-add-member
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (new-member (unwrap! (get recipient proposal) ERR-INVALID-PROPOSAL-PARAMS))
    (vault-data (get-vault-data vault-id))
    (slot-count (get member-index-count vault-data))
  )
    (asserts! (not (is-member-recorded vault-id new-member)) ERR-ALREADY-MEMBER)
    (asserts! (< (get member-count vault-data) MAX-MEMBERS) ERR-MAX-MEMBERS-REACHED)
    (map-set members {vault-id: vault-id, member: new-member}
      {contributed: u0, active: true, joined-at: stacks-block-height})
    (map-set vault-member-at {vault-id: vault-id, idx: slot-count} new-member)
    (map-set vaults vault-id
      (merge vault-data {
        member-count: (+ (get member-count vault-data) u1),
        member-index-count: (+ slot-count u1)
      }))
    (try! (contract-call? .vault-registry add-member-to-vault vault-id new-member))
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-remove-member
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (target (unwrap! (get recipient proposal) ERR-INVALID-PROPOSAL-PARAMS))
    (vault-data (get-vault-data vault-id))
    (member-data (unwrap! (member-record vault-id target) ERR-MEMBER-NOT-FOUND))
  )
    (asserts! (> (get member-count vault-data) u1) ERR-MIN-MEMBERS)
    (map-set members {vault-id: vault-id, member: target}
      (merge member-data {active: false}))
    (map-set vaults vault-id
      (merge vault-data {member-count: (- (get member-count vault-data) u1)}))
    (try! (contract-call? .vault-registry remove-member-from-vault vault-id target))
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-change-threshold
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (new-threshold (get amount proposal))
    (vault-data (get-vault-data vault-id))
  )
    (asserts!
      (and
        (>= new-threshold (contract-call? .governance-params get-min-threshold))
        (<= new-threshold (contract-call? .governance-params get-max-threshold)))
      ERR-INVALID-THRESHOLD)
    (map-set vaults vault-id (merge vault-data {threshold-percent: new-threshold}))
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-enable-yield (vault-id uint) (proposal-id uint))
  (begin
    (map-set vaults vault-id (merge (get-vault-data vault-id) {yield-enabled: true}))
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-disable-yield (vault-id uint) (proposal-id uint))
  (begin
    (map-set vaults vault-id (merge (get-vault-data vault-id) {yield-enabled: false}))
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-deposit-to-zest
    (token <ft-trait>)
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (amount (get amount proposal))
    (vault-data (get-vault-data vault-id))
    (current-position (contract-call? .zest-adapter get-zest-position-value vault-id))
  )
    (asserts! (get yield-enabled vault-data) ERR-YIELD-NOT-ENABLED)
    (asserts! (not (contract-call? .governance-params is-zest-deposits-paused)) ERR-ZEST-DEPOSITS-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= (get liquid-balance vault-data) amount) ERR-INSUFFICIENT-BALANCE)
    (let (
      (total-value (+ (get liquid-balance vault-data) current-position))
      (new-liquid (- (get liquid-balance vault-data) amount))
      (new-zest-total (+ current-position amount))
      (max-pct (contract-call? .governance-params get-max-zest-allocation-pct))
      (min-liquid-pct (contract-call? .governance-params get-min-liquid-reserve-pct))
    )
      (asserts! (<= (* new-zest-total u100) (* total-value max-pct)) ERR-EXCEEDS-ZEST-CAP)
      (asserts! (>= (* new-liquid u100) (* total-value min-liquid-pct)) ERR-BELOW-LIQUID-RESERVE)
      (try! (contract-call? token transfer amount (as-contract tx-sender) .zest-adapter none))
      (try! (contract-call? .zest-adapter deposit-to-zest token vault-id amount))
      (map-set vaults vault-id
        (merge vault-data {
          liquid-balance: new-liquid,
          zest-allocated: (+ (get zest-allocated vault-data) amount)
        }))
      (try! (contract-call? .proposal-manager mark-executed proposal-id))
      (ok true))))

(define-private (execute-withdraw-from-zest
    (token <ft-trait>)
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (let (
    (amount (get amount proposal))
    (position (contract-call? .zest-adapter get-zest-position-value vault-id))
  )
    (asserts! (not (contract-call? .governance-params is-zest-withdrawals-paused)) ERR-ZEST-WITHDRAWALS-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= position amount) ERR-INSUFFICIENT-BALANCE)
    (try! (contract-call? .zest-adapter withdraw-from-zest token vault-id amount))
    (record-zest-withdrawal-to-liquid vault-id amount)
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-change-beneficiary
    (vault-id uint)
    (proposal-id uint)
    (proposal {
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
    }))
  (begin
    (map-set vaults vault-id
      (merge (get-vault-data vault-id) {beneficiary: (get recipient proposal)}))
    (try! (contract-call? .proposal-manager mark-executed proposal-id))
    (ok true)))

(define-private (execute-close-vault (token <ft-trait>) (vault-id uint) (proposal-id uint))
  (let ((zest-position (contract-call? .zest-adapter get-zest-position-value vault-id)))
    (if (> zest-position u0)
      (begin
        (try! (contract-call? .zest-adapter withdraw-from-zest token vault-id zest-position))
        (record-zest-withdrawal-to-liquid vault-id zest-position)
        true)
      true)
    (let ((final-balance (get liquid-balance (get-vault-data vault-id))))
      (if (> final-balance u0)
        (begin
          (try! (distribute-by-share token vault-id final-balance))
          (map-set vaults vault-id
            (merge (get-vault-data vault-id) {
              liquid-balance: u0,
              zest-allocated: u0,
              status: STATUS-CLOSED
            }))
          (try! (contract-call? .vault-registry update-vault-status vault-id "CLOSED"))
          (try! (contract-call? .proposal-manager mark-executed proposal-id))
          (ok true))
        (begin
          (map-set vaults vault-id
            (merge (get-vault-data vault-id) {status: STATUS-CLOSED}))
          (try! (contract-call? .vault-registry update-vault-status vault-id "CLOSED"))
          (try! (contract-call? .proposal-manager mark-executed proposal-id))
          (ok true))))))

(define-public (sync-zest-yield (vault-id uint))
  (begin
    (asserts! (is-protocol-initialized) ERR-NOT-INITIALIZED)
    (asserts! (vault-exists vault-id) ERR-VAULT-NOT-FOUND)
    (asserts! (is-active-member-internal vault-id tx-sender) ERR-NOT-MEMBER)
    (let ((new-position (try! (contract-call? .zest-adapter sync-position vault-id))))
      (print {
        event: "yield-updated",
        vault-id: vault-id,
        zest-position: new-position,
        total-vault-value: (get-total-vault-value-internal vault-id),
        block: stacks-block-height
      })
      (ok new-position))))

(define-read-only (calc-member-share (vault-id uint) (member principal) (total-to-distribute uint))
  (match (member-record vault-id member)
    member-data
      (let ((total-contributed (get total-contributed (get-vault-data vault-id))))
        (if (is-eq total-contributed u0)
          u0
          (/ (* total-to-distribute (get contributed member-data)) total-contributed)))
    u0))

(define-read-only (get-member-share (vault-id uint) (member principal) (total-to-distribute uint))
  (calc-member-share vault-id member total-to-distribute))

(define-read-only (get-vault (vault-id uint))
  (unwrap-panic (map-get? vaults vault-id)))

(define-read-only (get-vault-optional (vault-id uint))
  (map-get? vaults vault-id))

(define-read-only (get-member (vault-id uint) (member principal))
  (member-record vault-id member))

(define-read-only (get-member-at (vault-id uint) (idx uint))
  (map-get? vault-member-at {vault-id: vault-id, idx: idx}))

(define-read-only (get-next-vault-id)
  (var-get next-vault-id))

(define-read-only (get-total-vault-value (vault-id uint))
  (get-total-vault-value-internal vault-id))

(define-read-only (get-vault-total-value (vault-id uint))
  (get-total-vault-value-internal vault-id))

(define-read-only (get-liquid-balance (vault-id uint))
  (get liquid-balance (get-vault-data vault-id)))

(define-read-only (get-vault-liquid-balance (vault-id uint))
  (get liquid-balance (get-vault-data vault-id)))

(define-read-only (get-zest-position-value (vault-id uint))
  (contract-call? .zest-adapter get-zest-position-value vault-id))

(define-read-only (get-vault-zest-position (vault-id uint))
  (contract-call? .zest-adapter get-zest-position-value vault-id))

(define-read-only (get-vault-yield-earned (vault-id uint))
  (contract-call? .zest-adapter get-yield-earned vault-id))

(define-read-only (get-vault-status (vault-id uint))
  (get status (get-vault-data vault-id)))

(define-read-only (get-vault-asset (vault-id uint))
  (get asset-contract (get-vault-data vault-id)))

(define-read-only (get-configured-sbtc-contract)
  (var-get configured-sbtc-contract))

(define-read-only (is-member (vault-id uint) (member principal))
  (is-member-recorded vault-id member))

(define-read-only (is-active-member (vault-id uint) (member principal))
  (is-active-member-internal vault-id member))

(define-read-only (get-required-approvals (vault-id uint))
  (let ((vault-data (get-vault-data vault-id)))
    (calc-required-approvals-internal (get member-count vault-data) (get threshold-percent vault-data))))
