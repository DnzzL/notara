Feature: Create an inline database

  As a user
  I want to create an inline database via the slash command
  So that I can organize structured data within my page

  Scenario: Create an inline database via slash command
    Given I have a page titled "Database Test"
    When I focus the ProseMirror editor
    And I type "/" to open the slash menu
    And I click the "Database" option
    Then I should see a database table
    And I should see the view switcher toolbar
