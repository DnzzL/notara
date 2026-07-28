Feature: Edit block content

  As a user
  I want to edit the content of a block in the editor
  So that I can write and modify my page content

  Scenario: Edit block content in the editor
    Given I have a page titled "Content Test"
    When I focus the ProseMirror editor
    And I type "Hello World"
    Then the editor should contain "Hello World"
