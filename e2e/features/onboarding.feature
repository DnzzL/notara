Feature: Onboarding flow

  As a new user
  I want to create my first workspace and a page
  So that I can start writing immediately

  Scenario: Create a workspace from the /workspaces page
    Given I am on the workspace page
    When I navigate to "/workspaces"
    And I click the "New workspace" button
    And I type "BDD Onboarding Workspace" in the workspace name field
    And I type "bdd-onboarding" in the workspace slug field
    And I click the "Create" button
    Then I should be redirected to the new workspace page
    And I should see "[data-sidebar]" in the page

  Scenario: Onboarding tour is skipped with localStorage
    Given I am on the workspace page
    When I type the command "localStorage.setItem('notara:tourCompleted', 'true')" in the browser
    And I reload the page
    Then the onboarding tour should not appear
