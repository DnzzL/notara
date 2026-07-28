Feature: Template creation and usage

  As a user
  I want to use templates when creating new pages
  So that I can start from pre-made layouts

  Scenario: Template picker opens when creating a new page
    Given I am on the workspace page
    When I click the new page button
    Then I should see a template picker dialog
    And "Blank page" should be visible as an option

  Scenario: Selecting Blank page creates a new editable page
    Given I am on the workspace page
    When I create a new blank page
    Then I should see an editable title input
