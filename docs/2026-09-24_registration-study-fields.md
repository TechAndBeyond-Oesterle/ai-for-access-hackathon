# Registration fields for team matching

Sources: the researcher's pre-match email (23 September 2026) and its survey attachments. The earlier hackathon's pre-survey is the example for matching inputs; its post-survey should be ignored. The Powercoders survey is the likely later event survey, and its grey sections may change.

## Collect at registration, for participants

| Field | Source and decision |
| --- | --- |
| Knowledge areas: AI & machine learning, optimization & simulation, software development, data, design & UX, law, other | Same six areas as the earlier hackathon's pre-survey, with shorter labels for optimization and software. Multiple choice; at least one area is required. |
| Relative skill level for each selected listed area | Pre-survey uses NA, novice, some experience, experienced, advanced, expert. Ask explicitly, using the scientist's wording comparing with people from work or school. Unselected areas are saved as NA. Debra notes levels were **not used** in the earlier LauzHack match, so do not assume the algorithm must weight them. |
| Team status | A checkbox asks whether an existing team exists. Only then do team status and team detail fields appear. An unchecked box records No team. Current info-session poll asks about teams, but that poll is optional and separate from registration. |
| Team name and current size | Added for existing teams so their registrations can be associated and teams of 2–3 identified. Teammates must use the same name. This is an implementation inference, not an explicit survey question. |
| Whether to suggest teammates | Everyone receives a team suggestion and decides whether to accept it. The pre-survey separately asks teams smaller than four if they welcome additions, so partially formed teams answer Yes or No to suggestions for their existing team. Solo participants need no additional team fields. Complete teams are recorded as No for additional members. |

The existing form already asks for name, email, role and optional age. Skill and team questions appear only when **Participant** is among the selected roles. The researcher did not specify which pre-match items must be mandatory. At least one knowledge area is required, each selected listed area requires a skill level, and team details are required only when an existing team is indicated.

## Collect later

Challenge rankings belong on a second form after challenge disclosure. The pre-match surveys show a dropdown for each challenge: ranks 1 through N, ties allowed, any number ranked, plus **unacceptable**. Neither actual challenge titles nor descriptions belong in the public registration page, its JavaScript, or a public API response before disclosure.

The likely PC event survey asks about hackathon experience, how people heard about the event, Powercoders alumni status, event ratings, barriers, team outcomes, professional background, gender, employment, residence status, language levels, qualifications and job search. These are not needed to suggest a team at signup. In particular, do not move the sensitive migration, employment and job-search questions into mandatory registration. The PC survey is still provisional, so the research team should finalize it separately.

## Data handling and release

This change stores answers only with the registration in Airtable and does not send them to the researcher. The privacy page explains the new collection and matching purpose. Before identifiable data is shared for the study, agree on the participant information and sharing process with the research team.

The matching columns and select choices were created in the live Registrations table on 24 September 2026. The existing `Role at hackathon` column is already a multiple-select field, compatible with the in-progress multi-role registration change. The idempotent `scripts/registration-schema.mjs` documents the schema for other environments; the current Airtable token returned HTTP 403 on the Meta API, so that script cannot run with this token.
