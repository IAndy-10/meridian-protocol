# AegisBrain: Screening-to-assessment measurement specification and synthetic reconciliation demonstrator

Review date: 12 October 2026
Status: research prototype; no customer validation, institutional approval, real patient data, or clinical effectiveness evidence.

## 1. Executive overview

AegisBrain will investigate one narrow implementation problem: making a screening-to-assessment documentation measure explicit, reproducible, and inspectable despite differences in workflow rules and record capture.

The first deliverable is a workflow-definition and simulation tool with a small source-linked reconciliation view. It is not a deployed clinical workflow monitor. It uses synthetic organizational procedures and synthetic records only.

The proposed primary user is a behavioral-health quality-improvement analyst working with a clinical-operations lead and informatics staff. This user, their unmet need, and their willingness to use or pay for a separate tool are hypotheses.

Strongest prospective prototype claim: given a versioned synthetic configuration and a known-answer dataset, AegisBrain can show which recorded screening events qualify, which assessment records link under declared rules, and which cases remain unmatched, ambiguous, or unmeasurable. That claim becomes demonstrated only after acceptance tests pass.

Published implementation evidence does not establish a market gap, customer demand, usability, lower workload, fewer missed assessments, or improved clinical outcomes.

## 2. Evidence-backed problem

### Published evidence

Coleman et al. describe implementation across five Kaiser Permanente regions. Local EHR activation, acceptable workflows, and explicit descriptions of what should happen and who should do it were implementation difficulties. The authors recommend standardized performance feedback and assigned responsibility for remediation. These are implementation observations and recommendations, not an evaluation of AegisBrain or of voice-based lookup. [P1]

Yarborough et al. identify difficulties mapping assessment versions, deciding what counts as follow-up, and finding relevant documentation. C-SSRS responses could be discrete fields or narrative summaries. The paper explicitly warns that this variation can undercount assessment efforts. [P2]

Richards et al. cataloged current and planned practices in six integrated health systems. Identification was relatively well-defined and measurable; engagement and transition practices were less consistently measured. Their findings support explicit practice and measurement definitions, but do not establish that unacknowledged handoffs are the principal cause of incomplete care. [P3]

Boggs et al. measured screening, assessment, and lethal-means-related documentation across six systems. The publisher abstract reports assessment after a positive screen in 76.8% of specialty mental-health cases and 43.2% of primary-care cases. The study uses PHQ-9 item 9 >=2 or an affirmative C-SSRS first question, and an assessment proxy of a response to C-SSRS question 2. Those figures are not rates of completed comprehensive clinical assessments. Nonextractable and narrative screening/assessment documentation was not captured, potentially underestimating practice delivery. [P4, P4a]

Ahmedani et al. found associations between bundled Zero Suicide implementation and changes in outpatient mental-health suicide-attempt rates. This observational interrupted-time-series study cannot attribute outcomes to a documentation monitor, a particular software feature, or any individual component of the bundle. [P5]

### Narrow problem statement

Teams implementing an approved screening-to-assessment pathway must specify eligibility, qualifying assessment evidence, responsibilities, documentation locations, matching rules, and reporting conventions before interpreting apparent workflow gaps. Published studies document difficulties doing this across systems. Their frequency and operational cost in the proposed adult outpatient customer segment are not established.

### Important quantitative cautions

- P1 reports nearly 10 million members; its 2019 continuous-membership description is 9,948,080. This is not the assessment-eligible denominator.
- P1's reported 0% to 82% change concerns indicated C-SSRS administration, not population-wide screening coverage, handoff acceptance, or clinical outcomes. Its aggregate calculation cannot be independently reconstructed from the extracted text alone.
- P1 defines indicated administration as C-SSRS within two business days after PHQ-9/PHQA item 9 >=1, among patients aged >=10 in specialty behavioral health or addiction medicine. It is not an adult-only measure.
- P4 uses different age, trigger, instrument, and denominator conventions. Do not directly compare its percentages with P1.
- A two-business-day reporting convention is never a clinically safe waiting period or a rule for urgency.
- P4's abstract reports 27.1% mental-health visit screening, while P5 cites 73% and different visit totals when referring to that work. This review could not resolve the discrepancy. Do not use either figure as an implementation benchmark.

## 3. Intended user and job to be done

Proposed user hypothesis: a quality-improvement analyst in adult outpatient specialty mental health, supported by an authorized clinical-operations lead and an EHR/informatics analyst.

Job hypothesis:

> Before interpreting a screening-to-assessment report, I need to inspect its approved rule, denominator, assessment definition, matching logic, data coverage, and unresolved records, so that I can distinguish a documentation or measurement problem from a case requiring further human investigation.

The initial application is not for patient intake, live crisis response, clinician risk determination, or on-call routing. It is not a replacement for institutional incident response or existing clinical task systems.

## 4. Product hypothesis

A source-linked specification and reconciliation view might make process-measure definitions easier to inspect than a spreadsheet or an opaque dashboard. This is unvalidated.

The prototype tests technical correctness and inspectability only. It does not test whether organizations need another application. The default eventual deployment hypothesis, if need is demonstrated, is an embedded reporting/QI integration rather than an independent clinical system of record.

Existing tools overlap substantially: EHR reporting and population-health tools offer care-gap analytics and operational reporting; communication tools offer role-based routing and on-call lookup; AHRQ and Zero Suicide resources already support implementation assessment. [P7-P11]

## 5. Evidence-to-feature mapping

| Proposed feature | Evidence classification | Initial decision |
|---|---|---|
| Explicit workflow and measure definition | Directly supported implementation need: P1-P4 | Include a fixed versioned configuration |
| Responsible role | Directly supported requirement at workflow level: P1 | Store synthetic clinical-role and QI-review-role fields separately |
| Deterministic record reconciliation | Reasonable design inference from P2/P4 measurement problems | Include |
| Missing and ambiguous linkage detection | Reasonable design inference; real prevalence unknown | Include with cautious labels |
| Exact source passage and rule provenance | Reasonable design inference, not evidence of demand | Include static source cards |
| Exception review | Unvalidated interface hypothesis | Include a small review annotation form |
| Audit history | Reasonable design inference for reproducibility | Include append-only application history; no compliance claim |
| Performance feedback | Direct author recommendation in P1; product benefit untested | Include count table, not efficacy claims |
| Remediation tracking | P1 recommends assigning remediation responsibility | Defer task management; allow review reason only |
| Voice | No demonstrated need or advantage in this segment | Exclude |
| Knowledge graph | No demonstrated necessity for one workflow | Exclude |
| Generative explanation | No demonstrated necessity; adds error surface | Exclude |
| Autonomous risk classification or urgency | Outside constraints | Prohibit |

## 6. Initial workflow and data model

### One workflow

A historical, already-recorded PHQ-9 screening event in adult outpatient specialty mental health is supplied with an explicit `assessmentRequired` eligibility flag from synthetic upstream workflow configuration. The demonstrator reconciles a subsequent C-SSRS assessment-documentation event.

The illustrative configuration uses item 9 >=1 to explain the eligibility flag, drawing on P1's process-measure convention. It does not administer, score, or interpret a patient instrument. Changing instrument or threshold requires a new explicit configuration version. ASQ/BSSA is not mixed into this metric.

Scope differs from P1: adults >=18, specialty mental health only, no addiction medicine. Therefore the demo is a transparent adaptation, not exact study replication.

### Objects

| Object | Required fields |
|---|---|
| SourceArtifact | id, kind (`PUBLICATION`, `SYNTHETIC_PROCEDURE`, future `LOCAL_APPROVED_POLICY`), title, URL or stored text, section locator, excerpt, content hash |
| ProtocolVersion | id, organizationId, version, approvalStatus, synthetic flag, approver label, effectiveFrom, effectiveTo, sourceArtifactId, timezone, calendarVersion, responsibleClinicalRole, operationalReviewRole |
| MeasureDefinition | id, version, protocolVersionId, population/setting filters, supplied eligibility rule, qualifying assessment predicate, linkage rules, reporting interval, time anchor, boundary inclusivity, duplicate/exclusion policy |
| ScreeningEvent | id, organizationId, syntheticPatientId, encounterId, occurredAt, recordedAt, ageAtEvent, setting, instrument/version, recorded item 9 value, assessmentRequired, eligibilityRuleVersion, sourceRecordId, sourceSystem, sourceLocation, provenance hash |
| AssessmentEvent | id, organizationId, syntheticPatientId, encounterId, triggeringScreenId (nullable), performedAt, recordedAt, instrument/version, documentationStatus, documentedCompletionFlag (supplied), sourceRecordId, sourceSystem, sourceLocation, provenance hash |
| CoverageManifest | runId, source locations included/omitted, extraction cutoff, data watermark, known missing feeds, coverageStatus |
| ReconciliationRun | id, configuration hash, engineVersion, asOf, extraction hash, screeningIds, assessmentIds, decisions, candidateIds, reason codes, numerator/denominator membership |
| ReviewAction | id, runId, screeningId, actor, timestamp, reason, evidenceReference, status, previousActionId |

Null is distinct from zero, false, and not required. `performedAt` and `recordedAt` remain separate. Completion flags are supplied documentation assertions, not inferred clinical adequacy.

### Deterministic reconciliation

1. Validate organization, identity, schema, source IDs, and time fields. Exact duplicate source records are idempotent; conflicting records sharing an ID are quarantined.
2. Pin the applicable configuration at screen occurrence, using half-open effective intervals `[effectiveFrom, effectiveTo)`. Missing or overlapping applicable versions block evaluation.
3. Determine eligibility from supplied fields and the configured scope. Missing eligibility fields produce indeterminate eligibility, not a negative screen. Future real deployment must establish upstream authority.
4. Find compatible assessment records for the same organization and patient, the configured instrument/version, and subsequent occurrence. Records lacking required timestamps or with incompatible status do not silently qualify.
5. Prefer a validated explicit `triggeringScreenId`. Validate identity and event timing even when this link exists. Otherwise allow same-encounter linkage only when there is exactly one candidate assessment and one eligible screen competing for that record.
6. Never choose the closest timestamp merely to resolve multiple candidates. Multiple assessments, multiple competing screens, conflicting links, or reuse conflicts produce ambiguous linkage. No assessment can satisfy two screens under the initial rule.
7. Evaluate the synthetic reporting interval only after establishing an unambiguous link. Preserve links outside the interval as outside-window documentation.
8. Emit machine-readable membership and reason codes. Every result can be traced to input IDs, configuration version, and coverage manifest.

### Illustrative reporting convention

The synthetic procedure uses a two-business-day documentation-linkage interval beginning at screen occurrence, inclusive of the endpoint. The deadline preserves local wall-clock time after advancing two eligible local dates. Calendar version specifies weekends, holidays, and timezone. This is an invented, testable implementation convention; the public paper does not fully specify holiday, timestamp, or duplicate handling.

The interval has no clinical-response meaning. The UI must not display clinical overdue labels, risk colors, or escalation recommendations.

## 7. Workflow and documentation states

Use orthogonal states rather than a single completed/not-completed flag.

### Eligibility

- `ELIGIBLE`: supplied eligibility flag and scope support inclusion.
- `NOT_ELIGIBLE`: explicit negative eligibility or scope exclusion, with reason.
- `INDETERMINATE`: required eligibility/configuration fields are missing or conflicting.
- `INVALID`: input cannot be safely evaluated; quarantined.

### Documentation linkage

- `QUALIFYING_RECORD_LINKED_WITHIN_WINDOW`: qualifying documentation under the declared rule, not proof of adequate care.
- `QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW`: documentation exists but does not satisfy the reporting convention.
- `NO_LINKED_RECORD_IN_AVAILABLE_DATA`: no qualifying link in the supplied extract. Never label this assessment not performed.
- `AMBIGUOUS_LINKAGE`: candidates exist but cannot be uniquely attributed.
- `PARTIAL_OR_NONQUALIFYING_RECORD`: a record exists but its supplied documentation predicate is not met.
- `NOT_YET_EVALUABLE`: reporting interval or feed watermark has not matured.
- `DATA_COVERAGE_UNKNOWN`: feed omissions prevent confident absence interpretation.

Coverage and maturity flags may coexist with linkage states. Count them separately rather than overriding provenance.

### Operational review

- `OPEN`, `IN_REVIEW`, `CLOSED_WITH_REASON`, `REOPENED`.
- Closing a review does not create assessment documentation or change the numerator.
- Patient refusal/nonattendance, care documented elsewhere, extraction failure, and alleged missed care are review reasons requiring evidence; they are not automatically denominator exclusions.
- Clinical handoff acknowledgement is not implemented and could never substitute for assessment documentation.

### Counts

Report eligible count, indeterminate/invalid/excluded counts, confirmed within-window links, outside-window links, ambiguous cases, partial records, absent links, immature cases, and coverage limitations.

An optional proportion is `confirmed within-window links / eligible mature events`. Retain ambiguous and coverage-unknown mature events in this denominator and flag the result as a conservative observed-linkage measure, not clinical compliance. Display all membership rows. Suppress the proportion for zero denominators. Do not impute missing records or silently drop difficult cases.

## 8. Role of approved institutional configuration

Keep three evidence planes separate:

1. Publications describe research, guidance, and measurement choices.
2. Approved institutional configuration defines local workflow authority.
3. Observed records show only what is present in the available data.

Public Kaiser publications are not current institution-approved SOPs and cannot provide a current named responsible clinician, contact roster, escalation route, or local response deadline.

All prototype procedures are prominently labeled `SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE`. A simulated approval label demonstrates provenance structure, not actual authorization.

Future real use requires institutional approval of scope, instrument/version, supplied eligibility, qualifying documentation, matching rules, clinical ownership, operational review ownership, exemptions, data capture, reporting interval, and change governance. An institution must not derive urgency from the application's reporting convention.

## 9. Role and limits of retrieval or generative AI

No retrieval engine or generative model is required in the initial prototype. Exact stored source passages and configuration IDs are sufficient.

HydraDB may remain available as an existing module, but it is off the critical path. Its optional later role is locating background material. It must not select clinical policy authority, determine eligibility, calculate measures, resolve ambiguous events, or generate clinical instructions.

Generative AI, voice recognition, TTS, and knowledge-graph traversal are deferred. Neither a graph nor per-tenant database naming establishes tenant security or clinical governance.

## 10. Initial prototype scope

- One fictional organization and one workflow.
- Seeded synthetic screens, assessments, coverage manifest, and two synthetic configuration versions.
- Fixed structured configuration; no visual workflow builder.
- Pure deterministic reconciliation function with fixtures and tests.
- A count table and event-level review list.
- A detail panel showing rule version, exact source passage, candidates, record evidence, and reason codes.
- Review annotations persisted separately from source records and computed results.
- JSON/CSV export of decisions and measure memberships.

Use existing Next.js for views, NestJS for one API module if already operational, and Prisma/PostgreSQL for configuration, run results, and annotations. Start with a pure TypeScript engine and fixtures if backend wiring would consume the test budget. Do not rebuild authentication, ingestion, or tenant infrastructure during five hours.

## 11. Acceptance criteria

1. Known-answer fixtures produce exactly their expected eligibility, linkage, maturity, coverage, and membership outputs.
2. Zero, null, false, and absent fields never collapse into the same meaning.
3. Age/setting exclusions and missing eligibility are independently testable.
4. Duplicate imports do not change counts; conflicting duplicates are quarantined.
5. Explicit links cannot cross patient/organization boundaries or bypass timing validation.
6. Multiple candidate assessments or competing screens produce ambiguity; no arbitrary nearest-event selection or assessment reuse.
7. Partial assessment documentation never silently becomes completed documentation.
8. Weekend, holiday, timezone, inclusive endpoint, and exactly-after-endpoint tests pass.
9. An immature interval is not counted as a mature unmatched exception.
10. Missing feeds remain visible; unknown coverage is never proof of absent care.
11. Version-boundary and overlapping-policy tests demonstrate historical reproducibility and explicit blocking.
12. Review closure cannot mutate clinical source events, denominator membership, or assessment numerator.
13. A late-arriving record creates a new reproducible run; the previous run remains inspectable.
14. Excerpts exactly match their stored sources; simulated policy authority remains labeled synthetic.
15. All measures expose numerator IDs, denominator IDs, exclusions, unknowns, engine version, extraction cutoff, and configuration hash.
16. UI contains no claims of clinical safety, urgency, compliance, demand, or effectiveness.

## 12. Validation plan

### Without customers

Create a compact known-answer dataset:

| Case | Expected result |
|---|---|
| E01-E04 | Eligible, mature, unique qualifying link within interval |
| E05 | Eligible, mature, unique qualifying link outside interval |
| E06-E07 | Eligible, mature, no linked record in complete supplied feeds |
| E08 | Eligible, mature, multiple candidate assessments |
| E09 | Eligible, mature, assessment contested by another eligible screen |
| E10 | Eligible but reporting interval not yet mature |
| E11 | Eligible, mature, partial/nonqualifying assessment record |
| E12 | Eligible, mature, no link and a known omitted feed |
| X01 | Explicit negative eligibility |
| X02 | Under 18 and excluded from adult-only scope |
| X03 | Primary-care event excluded from specialty scope |
| U01 | Missing eligibility field; indeterminate |

Additional assessments/screens used to test E09 must be declared in a separate focused fixture, not silently added to the main count fixture. The main fixture can represent E09 with a documented external competing event in its candidate-conflict metadata.

Expected main-fixture counts: 12 eligible, 11 mature eligible, 4 confirmed within-window links, 1 outside-window link, 2 ambiguous cases, 1 immature case, 1 partial record, and 3 absent-link cases including 1 coverage-unknown case. Three records are explicitly not eligible; one is indeterminate. Snapshot linkage is 4/12; optional mature observed-linkage proportion is 4/11. Neither is an empirical healthcare performance result.

The actual test implementation should use separate relational fixtures for multi-screen competition, then state each fixture's denominator explicitly. Hand-label expected outputs before writing reconciliation code.

### Published measure-definition exercise

Implement a separately labeled research profile resembling P1: age >=10, specialty behavioral health/addiction medicine, PHQ-9/PHQA item 9 >=1, qualifying C-SSRS documentation within two business days. Public text leaves instrument-completion semantics, repeat-screen matching, holiday treatment, and several timestamp conventions underspecified. Record every added assumption; do not claim exact reproduction until those are resolved.

P4's response-to-question-2 assessment proxy is different. Do not substitute it for a full completion definition or merge the profiles. Its assessment-numerator timing is not fully explicit in the extracted prose.

Synthetic testing can reproduce an operationalized metric definition, not original study data or empirical results. A count engine passing fixtures does not validate a clinical workflow.

### Requires users, institutional data, or a pilot

- Workflow fit and whether review states correspond to real work.
- Usability, review time, and cognitive burden.
- Data access, record mapping, coverage, and integration cost.
- Prevalence and causes of apparent gaps.
- Added value over current EHR reports, spreadsheets, and QI processes.
- Customer demand, budget ownership, procurement feasibility, and willingness to pay.
- Clinical effectiveness, unintended effects, and patient outcomes.

Any real pilot requires separate institutional governance, privacy/security review, and a clearly defined evaluation protocol. The prototype itself establishes none of these.

## 13. Out of scope and safety boundaries

No administration or scoring of PHQ-9, ASQ, or C-SSRS; no patient risk inference; no urgency or disposition decisions; no clinical assessment; no patient interaction; no emergency dispatch; no live escalation; no on-call directory; no handoff messaging; no patient audio; no real patient data.

No claim of regulatory compliance, clinical effectiveness, improved suicide outcomes, prevention of missed care, or validated demand.

ASQ, PHQ-9, and C-SSRS are not interchangeable. NIMH ASQ guidance describes a trained-clinician BSSA after a positive ASQ screen in medical settings; that is separate from the chosen PHQ-9/C-SSRS documentation profile. [P6]

A missing record is not proof of missed care. A response to a questionnaire item is not proof of comprehensive assessment quality. Review closure is not clinical completion. A reporting window is not clinical permission to wait.

## 14. Unresolved assumptions

- A prospective customer has a meaningful, underserved measurement/review problem.
- Required data can be extracted consistently at an acceptable cost.
- Structured definitions can represent local exemptions and assessment-documentation conventions.
- Apparent gaps are actionable rather than primarily documentation-location or feed-coverage artifacts.
- Review staff have time and authority to investigate exceptions.
- Source-linked provenance provides value beyond a well-documented EHR report.
- A separate product offers enough benefit to justify maintenance and governance costs.

Competing explanations include undocumented care, documentation elsewhere, incorrect matching, exemptions, refusal/nonattendance, inadequate staffing, missing feeds, and genuinely omitted assessment. The prototype does not decide which explanation is true.

Falsification: discontinue or substantially change the product if existing reports already solve the job adequately, reliable inputs cannot be obtained, exception review mostly creates false alarms or duplicate work, or prospective users do not prioritize the problem.

## 15. Prioritized build plan

Five hours is a time-boxed technical demonstration, not production readiness.

| Time | Priority | Deliverable |
|---|---|---|
| 0:00-0:45 | Define schema, configuration, sources, and hand-labeled fixtures | Reproducible input/output contract |
| 0:45-2:15 | Implement pure reconciliation and test hard cases first | Passing deterministic tests |
| 2:15-3:00 | Wire seeded persistence and one evaluation endpoint if stack is ready | Stored run with provenance |
| 3:00-4:00 | Build count table, event list, and evidence/detail panel | Inspectable outputs |
| 4:00-4:30 | Add separate review annotation and export | Closure cannot alter documentation |
| 4:30-5:00 | Run boundary/adversarial tests and record a scripted demo | Test report and explicit limitations |

If time runs short, keep fixtures, reconciliation tests, and one inspectable view. Cut annotations, backend expansion, and polish before cutting correctness tests. No voice, generative synthesis, graph ingestion, clinical notifications, live connectors, or visual workflow editor.

Demo: inspect synthetic rule; run fixture; show denominator; inspect one valid link, one ambiguous case, one missing-feed case; close an operational review without changing the metric; show a new run after late documentation; display test results and limitations.

## 16. Supporting publications

These links identify public evidence, not institutional clinical authority.

[P1] Coleman KJ et al. Identifying People at Risk for Suicide: Implementation of Screening for the Zero Suicide Initiative in Large Health Systems. Advances in Psychiatry and Behavioral Health. 2021;1:67-76. Online 9 August 2021; September issue. DOI: 10.1016/j.ypsc.2021.05.016. Full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC13440321/ . PMC availability in August 2026 is not the original publication date.

[P2] Yarborough BJH et al. Challenges of Population-based Measurement of Suicide Prevention Activities Across Multiple Health Systems. eGEMs. 12 April 2019;7(1):13. DOI: 10.5334/egems.277. https://pmc.ncbi.nlm.nih.gov/articles/PMC6460503/

[P3] Richards JE et al. An implementation evaluation of “Zero Suicide” using normalization process theory to support high-quality care for patients at risk of suicide. Implementation Research and Practice. 24 May 2021;2. DOI: 10.1177/26334895211011769. https://pmc.ncbi.nlm.nih.gov/articles/PMC8384258/

[P4] Boggs JM et al. Suicide Screening, Risk Assessment, and Lethal Means Counseling During Zero Suicide Implementation. Psychiatric Services. Online 3 April 2024; print 1 July 2024;75(7):638-645. DOI: 10.1176/appi.ps.20230211. Author manuscript has the expanded title Suicide Ideation Screening, Risk Assessment, and Lethal Means Counseling During Zero Suicide Implementation Across Six Large U.S. Healthcare Systems. https://pmc.ncbi.nlm.nih.gov/articles/PMC11404670/ . Supplemental figure and NLP appendix are listed there; their contents were not independently inspected in this review.

[P4a] Publisher/indexed abstract, including exact 76.8% and 43.2% assessment percentages: https://pubmed.ncbi.nlm.nih.gov/38566561/

[P5] Ahmedani BK et al. Zero Suicide Model Implementation and Suicide Attempt Rates in Outpatient Mental Health Care. JAMA Network Open. 7 April 2025;8(4):e253721. DOI: 10.1001/jamanetworkopen.2025.3721. https://pmc.ncbi.nlm.nih.gov/articles/PMC11976489/ . Supplement 1 contains an eFigure of site trends and eTable of quarterly attempt counts; Supplement 2 is the data-sharing statement. Supplement listings were located, but the supplementary tables/files were not successfully retrieved in this review.

[P6] NIMH. Ask Suicide-Screening Questions Toolkit and adult materials. https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials and https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials/adults-asq-toolkit

[P7] AHRQ. Workflow Assessment for Health IT Toolkit. https://digital.ahrq.gov/health-it-tools-and-resources/evaluation-resources/workflow-assessment-health-it-toolkit

[P8] Epic. Population Health. Vendor capability documentation, not independent outcome evidence. https://www.epic.com/software/population-health/

[P9] UC Davis Health. Epic Reporting Workbench. Institutional capability documentation. https://health.ucdavis.edu/data/epic-reporting-workbench.html

[P10] TigerConnect. Clinical communication integrations. Vendor capability documentation, not independent effectiveness evidence. https://tigerconnect.com/products/integrations/

[P11] Zero Suicide implementation resources and evidence base. https://zerosuicide.edc.org/evidence/evidence-base

Additional contextual evidence, not primary justification: Beverly B et al. Implementing Digital Suicide Risk Screening in Behavioral Health: a Mixed-methods Study of Organizational Adaptation. Community Mental Health Journal. 2026. DOI: 10.1007/s10597-026-01647-0. https://link.springer.com/article/10.1007/s10597-026-01647-0 . Public abstract/appendix and disclosures were accessible; main results text was not accessible. Nine asynchronous digital-screening organizations, mixed service lines, commercial funding, and all authors previously employed by NeuroFlow limit transfer and independence. This is not Kaiser-associated research and does not demonstrate a need for voice lookup or a new acknowledgement tool.
