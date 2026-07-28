Feature: Search

  As a user
  I want to search for pages and block content
  So that I can quickly find what I need

  Scenario: Search finds pages
    Given I have a page titled "Searchable Content"
    When I open the search modal
    And I type "Searchable" in the search input
    Then I should see "Searchable Content" in the search results
