import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDate, groupNotesByDate } from './utils';

describe('Date Utilities', () => {
	const mockNow = new Date('2024-05-20T10:00:00Z'); // A Monday

	describe('formatDate', () => {
		it('should return "Today" for current day', () => {
			const date = '2024-05-20T02:00:00Z';
			expect(formatDate(date, mockNow)).toBe('Today');
		});

		it('should return "Yesterday" for previous day', () => {
			const date = '2024-05-19T23:00:00Z';
			expect(formatDate(date, mockNow)).toBe('Yesterday');
		});

		it('should return day of week for within last 7 days', () => {
			const date = '2024-05-18T10:00:00Z'; // Sunday
			expect(formatDate(date, mockNow)).toBe('Sunday');
		});

		it('should return full date for older dates', () => {
			const date = '2024-05-10T10:00:00Z';
			expect(formatDate(date, mockNow)).toContain('May');
			expect(formatDate(date, mockNow)).toContain('2024');
		});
	});

	describe('groupNotesByDate', () => {
		it('should group notes by calendar day and sort descending', () => {
			const notes = [
				{ id: '1', updatedAt: '2024-05-20T05:00:00Z', title: 'Today 1' },
				{ id: '2', updatedAt: '2024-05-19T22:00:00Z', title: 'Yesterday 1' },
				{ id: '3', updatedAt: '2024-05-20T08:00:00Z', title: 'Today 2' }
			];

			const groups = groupNotesByDate(notes, mockNow);

			expect(groups.length).toBe(2);
			
			// First group should be Today
			expect(groups[0][0]).toBe('Today');
			expect(groups[0][1].length).toBe(2);
			
			// Second group should be Yesterday
			expect(groups[1][0]).toBe('Yesterday');
			expect(groups[1][1].length).toBe(1);
			expect(groups[1][1][0].title).toBe('Yesterday 1');
		});

		it('should handle dates across year boundaries', () => {
			const now = new Date('2024-01-01T10:00:00Z');
			const noteDate = '2023-12-31T22:00:00Z';
			
			expect(formatDate(noteDate, now)).toBe('Yesterday');
		});
	});
});
