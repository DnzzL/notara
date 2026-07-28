Feature: Create a page

  As a user
  I want to create a new page with a title
  So that I can start organizing my content

  Scenario: Create a page with a title
    Given I am on the workspace page
    When I click the "New Page" button
    And I type "My New Page" as the page title
    And I press Enter
    Then I should see a page titled "My New Page"
