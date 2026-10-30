"""HTTP errors shared by the event service and judging workflow."""


class APIError(Exception):
    def __init__(self, status, message):
        self.status,self.message=status,message
