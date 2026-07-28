Feature: Trash and restore

  As a user
  I want to trash a page and restore it
  So that I can recover accidentally deleted content

  Scenario: Trash a page
    Given I have a page titled "Page to Trash"
    When I open the page menu
    And I click "Delete"
    Then the page should no longer appear in the sidebar

  Scenario: Restore a trashed page
    Given I have trashed a page titled "Page to Restore"
    When I open the trash modal
    And I click "Restore" on the trashed page
    Then the page should reappear in the sidebar
