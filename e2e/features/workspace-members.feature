Feature: Workspace member management

  As a workspace admin
  I want to manage workspace members and invite new ones
  So that I can control access to my team's workspace

  Scenario: View workspace members
    Given I am on the workspace page
    When I navigate to "/settings/e2e"
    Then I should see the "Members" tab selected by default
    And I should see my own member entry

  Scenario: Invite a new member by email
    Given I am on the workspace settings page for "e2e"
    When I type "new-member@example.com" in the invite email field
    And I click "Send Invite"
    Then I should see an invitation sent confirmation

  Scenario: Copy invite link
    Given I am on the workspace settings page for "e2e"
    When I click the "Copy Invite Link" button
    Then I should see a link copied confirmation
    And the invite link should be in the clipboard
