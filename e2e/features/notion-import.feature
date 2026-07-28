Feature: Notion import

  As a user migrating from Notion
  I want to import my Notion data
  So that I can continue working with my existing content

  Scenario: Open the import dialog
    Given I am on the workspace page
    When I navigate to "/settings/e2e"
    And I click "Import / Export"
    Then I should see an import dialog
    And I should see "Notion import" or a file upload area

  Scenario: Import requires a file to be selected
    Given I am on the workspace page
    And I open the import dialog
    When I click "Import" without selecting a file
    Then I should see a validation message about selecting a file
