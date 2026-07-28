Feature: Database filter and sort

  As a power user
  I want to filter and sort database rows
  So that I can find and organize data quickly

  Scenario: Create a database, then filter rows
    Given I have a page titled "Filterable DB"
    And I type "/" to open the slash menu
    And I click the "Database" option
    Then I should see a database table
    When I click the "Filter" button in the database toolbar
    Then I should see the filter panel

  Scenario: Sort a database column
    Given I have a page titled "Sortable DB"
    And I type "/" to open the slash menu
    And I click the "Database" option
    Then I should see a database table
    When I click a column header in the database
    And I click "Sort ascending"
    Then the column should have a sort indicator
