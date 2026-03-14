import { describe, it, expect } from 'vitest';
import { AppView, PLAYERS_PER_TEAM, Golfer, Team, DataSource, LeagueSettings } from './types';

describe('types', () => {
  describe('AppView enum', () => {
    it('has all expected view values', () => {
      expect(AppView.DASHBOARD).toBe(0);
      expect(AppView.MASTERS).toBe(1);
      expect(AppView.RANKINGS).toBe(2);
      expect(AppView.DRAFT).toBe(3);
      expect(AppView.TEAMS).toBe(4);
      expect(AppView.ADMIN).toBe(5);
    });
  });

  describe('PLAYERS_PER_TEAM constant', () => {
    it('equals 3', () => {
      expect(PLAYERS_PER_TEAM).toBe(3);
    });
  });

  describe('Golfer interface', () => {
    it('allows creating a golfer with required fields', () => {
      const golfer: Golfer = {
        id: '1',
        name: 'Scottie Scheffler',
        rank: 1,
      };

      expect(golfer.id).toBe('1');
      expect(golfer.name).toBe('Scottie Scheffler');
      expect(golfer.rank).toBe(1);
    });

    it('allows optional fields', () => {
      const golfer: Golfer = {
        id: '1',
        name: 'Scottie Scheffler',
        rank: 1,
        country: 'USA',
        odds: '+500',
        position: 1,
        topar: -10,
        thru: 'F',
        today: '-3',
      };

      expect(golfer.country).toBe('USA');
      expect(golfer.odds).toBe('+500');
      expect(golfer.position).toBe(1);
      expect(golfer.topar).toBe(-10);
      expect(golfer.thru).toBe('F');
      expect(golfer.today).toBe('-3');
    });

    it('allows string values for position and topar', () => {
      const golfer: Golfer = {
        id: '1',
        name: 'Test Player',
        rank: 1,
        position: 'T1',
        topar: 'E',
      };

      expect(golfer.position).toBe('T1');
      expect(golfer.topar).toBe('E');
    });
  });

  describe('Team interface', () => {
    it('allows creating a team with required fields', () => {
      const team: Team = {
        id: 'team1',
        teamId: 'team1',
        name: 'Team Alpha',
        ownerEmail: 'owner@example.com',
        ownerId: 'owner1',
        logoUrl: 'https://example.com/logo.png',
        roster: [],
        year: 2024,
      };

      expect(team.id).toBe('team1');
      expect(team.name).toBe('Team Alpha');
      expect(team.ownerEmail).toBe('owner@example.com');
      expect(team.logoUrl).toBe('https://example.com/logo.png');
      expect(team.roster).toEqual([]);
      expect(team.year).toBe(2024);
    });

    it('allows optional players field for legacy support', () => {
      const golfer: Golfer = { id: '1', name: 'Player', rank: 1 };
      const team: Team = {
        id: 'team1',
        teamId: 'team1',
        name: 'Team Alpha',
        ownerEmail: 'owner@example.com',
        ownerId: 'owner1',
        logoUrl: '',
        roster: [golfer],
        year: 2024,
        players: [golfer],
      };

      expect(team.players).toEqual([golfer]);
    });
  });

  describe('DataSource interface', () => {
    it('allows creating a data source with name only', () => {
      const dataSource: DataSource = {
        name: 'API Source',
      };

      expect(dataSource.name).toBe('API Source');
      expect(dataSource.url).toBeUndefined();
    });

    it('allows optional url', () => {
      const dataSource: DataSource = {
        name: 'API Source',
        url: 'https://api.example.com',
      };

      expect(dataSource.url).toBe('https://api.example.com');
    });
  });

  describe('LeagueSettings interface', () => {
    it('allows creating league settings', () => {
      const settings: LeagueSettings = {
        year: 2024,
        teamCount: 8,
        playersPerTeam: 3,
        draftStatus: 'pre-draft',
      };

      expect(settings.year).toBe(2024);
      expect(settings.teamCount).toBe(8);
      expect(settings.playersPerTeam).toBe(3);
      expect(settings.draftStatus).toBe('pre-draft');
    });

    it('allows all draft status values', () => {
      const preDraft: LeagueSettings = {
        year: 2024,
        teamCount: 8,
        playersPerTeam: 3,
        draftStatus: 'pre-draft',
      };

      const inProgress: LeagueSettings = {
        year: 2024,
        teamCount: 8,
        playersPerTeam: 3,
        draftStatus: 'in-progress',
      };

      const complete: LeagueSettings = {
        year: 2024,
        teamCount: 8,
        playersPerTeam: 3,
        draftStatus: 'complete',
      };

      expect(preDraft.draftStatus).toBe('pre-draft');
      expect(inProgress.draftStatus).toBe('in-progress');
      expect(complete.draftStatus).toBe('complete');
    });

    it('allows optional tournamentLogoUrl', () => {
      const settings: LeagueSettings = {
        year: 2024,
        teamCount: 8,
        playersPerTeam: 3,
        draftStatus: 'pre-draft',
        tournamentLogoUrl: 'https://example.com/logo.png',
      };

      expect(settings.tournamentLogoUrl).toBe('https://example.com/logo.png');
    });
  });
});
