Feature: Page sharing with permissions

  As a workspace member
  I want to share pages and manage permissions
  So that I can control who sees and edits my content

  Scenario: Open the share dialog for a page
    Given I have a page titled "Shared Page"
    When I click the page menu button
    And I click "Share" in the menu
    Then I should see a share dialog
    And I should see "Share page" as the dialog title

  Scenario: Grant a member editor access
    Given I have a page titled "ACL Page"
    And I open the share dialog for the current page
    When I select "Editor" from the relation dropdown
    Then the page should have an editor ACL applied
