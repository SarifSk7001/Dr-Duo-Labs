# IBM Bob Usage Documentation

## Project: Experiment Exchange + Hypothesia

**Project Name:** Experiment Exchange + Hypothesia\
**Purpose:** A searchable research platform for recording scientific
experiments---including successful, failed, and inconclusive
results---and helping researchers evaluate hypotheses using recorded
evidence.

------------------------------------------------------------------------

## 1. Overview

Experiment Exchange + Hypothesia is designed to help researchers
preserve experimental knowledge, discover related work, reduce
unnecessary repetition of experiments, and examine hypotheses against
available evidence.

The project includes an experiment repository, search and similarity
features, evidence-grounded AI assistance, experiment comparison,
version history, and research-paper discovery. The AI assistant is
intended to support researchers; its suggestions should not be treated
as verified scientific conclusions without human review.

## 2. How IBM Bob Was Used

IBM Bob was used as a development assistant during work on the project.
It can support software development by helping the developer understand
requirements, plan implementation, inspect code, identify bugs, and
improve documentation.

For this project, describe only the activities that you actually
performed with IBM Bob. Relevant project-specific activities may
include:

-   **Requirement breakdown:** turning the project idea into smaller
    implementation tasks for the frontend, backend, database, and AI
    features.
-   **Code understanding and implementation support:** explaining or
    assisting with React/Vite frontend components and Python/FastAPI
    backend routes, where used.
-   **API and data-flow review:** helping reason about how experiment
    records, search requests, and hypothesis-evaluation requests move
    between the frontend, backend, database, and AI service.
-   **Debugging:** helping investigate errors, review tracebacks, or
    reason about unexpected behaviour during development.
-   **Database and validation review:** assisting with the review of
    experiment fields, request/response schemas, database operations,
    and validation logic.
-   **AI feature review:** helping examine the workflow for retrieving
    relevant experiment records and presenting evidence-based responses.
-   **Documentation:** helping organise project setup instructions,
    feature descriptions, and technical documentation.

**Accuracy note:** Keep only the bullet points that match your actual
use of IBM Bob. Do not claim that Bob generated, tested, or fixed code
unless you personally used it for that task and reviewed the result.

## 3. Project Technology Stack

The project documentation describes the following technologies:

-   **Frontend:** React, Vite, React Router, and Tailwind CSS.
-   **Backend:** Python, FastAPI, Uvicorn, and Pydantic.
-   **Database and search:** PostgreSQL, SQLAlchemy, pgvector, and
    JSONB.
-   **Database migrations:** Alembic.
-   **AI integration:** IBM watsonx.ai with IBM Granite models.
-   **Authentication and security-related libraries:** bcrypt,
    python-jose/JWT, slowapi, and defusedxml.
-   **Research discovery:** OpenAlex and arXiv APIs.
-   **Testing tools:** pytest and httpx.

IBM Bob is the development assistant; it is separate from the IBM
Granite models and the watsonx.ai services used by the application's AI
features.

## 4. Where AI Is Used in the Application

The application's AI features are separate from the use of IBM Bob
during development.

The documented AI workflow uses IBM Granite models through IBM
watsonx.ai for text generation and embeddings. Relevant experiment
records can be retrieved to provide context for hypothesis evaluation.
The application is designed to validate cited experiment IDs against
retrieved records and reject citations that were not retrieved, helping
reduce unsupported AI claims.

AI-generated suggestions remain subject to researcher review. Similar
wording between experiments does not automatically mean the experiments
are scientifically equivalent.

## 5. Development Workflow

A responsible workflow for using IBM Bob on this project is:

1.  Identify a specific development task or bug.
2.  Provide the relevant requirements and code context to IBM Bob.
3.  Review its explanation or proposed changes.
4.  Apply only changes that fit the project's architecture and
    requirements.
5.  Run the application and relevant tests where available.
6.  Check the result manually and revise the implementation if
    necessary.
7.  Update project documentation when behaviour or setup instructions
    change.

IBM Bob's output should be treated as assistance, not as automatically
correct code. Generated suggestions must be reviewed, tested, and
checked for security and correctness before being accepted.

## 6. Example Project Areas

The following areas are relevant to the project and may be mentioned if
IBM Bob actually assisted with them:

-   Experiment record creation and management.
-   Search across successful, failed, and inconclusive experiments.
-   Similar-experiment or duplicate warnings.
-   Hypothesis evaluation using retrieved evidence.
-   Experiment comparison and version history.
-   Research-paper search and import.
-   API integration and frontend/backend communication.
-   Setup instructions and project documentation.

For a stronger submission, add one or two concrete examples of your own
work---for example, the issue you gave IBM Bob, the suggestion it
provided, what you changed, and how you verified the result.

## 7. Benefits and Limitations

**Benefits** - Helped organise development work into smaller tasks. -
Could make unfamiliar code and error messages easier to understand. -
Could support debugging and documentation. - Could help review
consistency between requirements and implementation.

**Limitations** - Suggestions may be incorrect, incomplete, or
unsuitable for the existing codebase. - Code and configuration changes
require developer review and testing. - AI-generated research content is
not a substitute for scientific verification. - No specific productivity
improvement or test result is claimed in this document unless measured
separately.

## 8. Conclusion

IBM Bob can support the development of Experiment Exchange + Hypothesia
by assisting with planning, code understanding, debugging,
implementation review, and documentation. The project itself uses IBM
Granite through watsonx.ai for its evidence-oriented AI functionality.
These are distinct roles: IBM Bob assists with building the software,
while the integrated AI models power selected features within the
application.

**Before publishing:** Review this document and remove or edit any
statement that does not reflect how you actually used IBM Bob. Add a
concrete example of your own IBM Bob interaction if available.
