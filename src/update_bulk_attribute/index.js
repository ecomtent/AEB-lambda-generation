const { updateListing } = require('utils/aws_services');

exports.handler = async (event) => {
  const { seller_id, listing_id, is_bulk_generating } = event
  if (!seller_id || !listing_id || !is_bulk_generating) {
    throw new Error('Bad request - Missing required fields');
  }

  const listingUpdates = {
    seller_id: seller_id,
    listing_id: listing_id,
    listing_updates: {
      is_bulk_generating: is_bulk_generating,
    },
  };

  try {
    const result = await updateListing(listingUpdates);
    if (result) {
      console.log(`Listing updated successfully to modify is_bulk_generating to ${is_bulk_generating}:`, result);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Listing updated successfully to modify is_bulk_generating to ${is_bulk_generating}`, result }),
      };
    } else {
      console.error('Failed to update listing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update listing' }),
      };
    }
  } catch (error) {
    console.error('Error invoking Lambda function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error invoking Lambda function',
        error: error.message
      })
    };
  }
};
