## ADDED Requirements

### Requirement: Filter benefits by state
The system SHALL return benefits matching the requested state, retaining their original order and leaving the input collection unchanged.

#### Scenario: Filter active benefits
- **WHEN** active is requested
- **THEN** only active benefits are returned in their original order

#### Scenario: No filter
- **WHEN** all is requested
- **THEN** all benefits are returned as a new array in the original order

#### Scenario: Unknown state
- **WHEN** a state other than active, inactive or all is requested
- **THEN** a RangeError is raised
